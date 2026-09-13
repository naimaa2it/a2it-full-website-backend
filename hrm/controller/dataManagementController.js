// ========================================================================
// Data Management (HRM Settings → Delete Data / Trash)
//
// Lets an admin delete transactional HRM data month-wise or for a whole year.
// Deleted records are snapshotted into the Trash collection (see TrashModel)
// and removed from their source collection; they are permanently purged after
// 10 days (TTL index + lazy purge safeguard). Until then they can be restored.
// ========================================================================

const Trash = require("../models/TrashModel");

const Attendance = require("../models/AttendanceModel");
const Payroll = require("../models/PayrollModel");
const Leave = require("../models/LeaveModel");
const FoodCost = require("../models/foodCostModel");
const TransportExpense = require("../models/transportModel");
const OfficeSupply = require("../models/officeSupplyModel");
const UtilityBill = require("../models/utilitybillsModel");
const OfficeRent = require("../models/officeRentModel");
const Meal = require("../models/mealModel");
const ExtraExpense = require("../models/miscellaneousModel");
const SoftwareSubscription = require("../models/softwareSubscriptionModel");

const RETENTION_DAYS = 10;

// ── Registry ──────────────────────────────────────────────────────────
// Each deletable data type maps to its Mongoose model and the strategy used
// to select records for a given month/year:
//   - dateField : the Date field whose value must fall inside the range
//   - monthYear : true  → the model stores explicit numeric `month`/`year`
// `dateField` and `monthYear` are mutually exclusive.
const REGISTRY = {
  attendance: { model: Attendance, sourceModel: "Attendance", label: "Attendance", dateField: "date" },
  payroll: { model: Payroll, sourceModel: "Payroll", label: "Payroll", monthYear: true },
  leave: { model: Leave, sourceModel: "Leave", label: "Leave", dateField: "startDate" },
  meal: { model: Meal, sourceModel: "Meal", label: "Meal", dateField: "date" },
  foodCost: { model: FoodCost, sourceModel: "FoodCost", label: "Food Cost", dateField: "date" },
  transport: { model: TransportExpense, sourceModel: "TransportExpense", label: "Transport", dateField: "date" },
  officeSupply: { model: OfficeSupply, sourceModel: "OfficeSupply", label: "Office Supplies", dateField: "date" },
  utilityBill: { model: UtilityBill, sourceModel: "UtilityBill", label: "Utility Bills", monthYear: true },
  officeRent: { model: OfficeRent, sourceModel: "OfficeRent", label: "Office Rent", dateField: "date" },
  miscellaneous: { model: ExtraExpense, sourceModel: "ExtraExpense", label: "Miscellaneous", dateField: "date" },
  softwareSubscription: { model: SoftwareSubscription, sourceModel: "SoftwareSubscription", label: "Software Subscriptions", dateField: "date" },
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Build the Mongo filter that selects a config's records for the given scope.
// scope === "month" → that month only; scope === "year" → the whole year.
const buildFilter = (cfg, scope, month, year) => {
  if (cfg.monthYear) {
    return scope === "month" ? { month, year } : { year };
  }
  // Date-range strategy
  const start =
    scope === "month" ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
  const end =
    scope === "month"
      ? new Date(year, month, 0, 23, 59, 59, 999)
      : new Date(year, 11, 31, 23, 59, 59, 999);
  return { [cfg.dateField]: { $gte: start, $lte: end } };
};

// Lazy safeguard: purge trash entries whose 10-day window has passed. The TTL
// index normally does this in the background; this guarantees a clean view the
// moment the trash is opened even if the background sweep hasn't run yet.
const purgeExpiredTrash = async () => {
  try {
    await Trash.deleteMany({ expiresAt: { $lte: new Date() } });
  } catch (e) {
    console.error("Trash purge error:", e.message);
  }
};

// ── GET /admin/data/summary?scope=&month=&year= ─────────────────────────
// Returns the record count per data type that WOULD be deleted, so the UI can
// show the user what they're about to remove before they confirm.
exports.getDeletableSummary = async (req, res) => {
  try {
    const scope = req.query.scope === "year" ? "year" : "month";
    const year = parseInt(req.query.year);
    const month = parseInt(req.query.month);

    if (!year || (scope === "month" && !month)) {
      return res.status(400).json({
        status: "fail",
        message: "Year (and month for month scope) are required",
      });
    }

    const summary = [];
    for (const [key, cfg] of Object.entries(REGISTRY)) {
      const filter = buildFilter(cfg, scope, month, year);
      const count = await cfg.model.countDocuments(filter);
      summary.push({ dataType: key, label: cfg.label, count });
    }

    res.status(200).json({
      status: "success",
      data: {
        scope,
        month: scope === "month" ? month : null,
        monthName: scope === "month" ? MONTH_NAMES[month - 1] : null,
        year,
        summary,
        totalRecords: summary.reduce((s, r) => s + r.count, 0),
      },
    });
  } catch (error) {
    console.error("getDeletableSummary error:", error);
    res.status(500).json({ status: "fail", message: error.message });
  }
};

// ── POST /admin/data/delete ─────────────────────────────────────────────
// Body: { scope: "month"|"year", month, year, dataTypes: ["attendance", ...] }
// Snapshots matching records into Trash, then removes them from source.
exports.deleteData = async (req, res) => {
  try {
    const { scope: rawScope, month, year, dataTypes } = req.body;
    const scope = rawScope === "year" ? "year" : "month";

    if (!year || (scope === "month" && !month)) {
      return res.status(400).json({
        status: "fail",
        message: "Year (and month for month scope) are required",
      });
    }
    if (!Array.isArray(dataTypes) || dataTypes.length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "Select at least one data type to delete",
      });
    }

    const invalid = dataTypes.filter((t) => !REGISTRY[t]);
    if (invalid.length) {
      return res.status(400).json({
        status: "fail",
        message: `Unknown data type(s): ${invalid.join(", ")}`,
      });
    }

    const deletedBy = {
      id: req.user?._id,
      name:
        req.user?.name ||
        `${req.user?.firstName || ""} ${req.user?.lastName || ""}`.trim() ||
        "Admin",
      email: req.user?.email,
    };
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const results = [];
    for (const key of dataTypes) {
      const cfg = REGISTRY[key];
      const filter = buildFilter(cfg, scope, parseInt(month), parseInt(year));

      // Snapshot the raw documents before removing them
      const docs = await cfg.model.find(filter).lean();
      if (docs.length === 0) {
        results.push({ dataType: key, label: cfg.label, moved: 0 });
        continue;
      }

      await Trash.create({
        dataType: key,
        sourceModel: cfg.sourceModel,
        label: cfg.label,
        scope,
        month: scope === "month" ? parseInt(month) : undefined,
        year: parseInt(year),
        recordCount: docs.length,
        documents: docs,
        deletedAt: now,
        expiresAt,
        deletedBy,
      });

      await cfg.model.deleteMany({ _id: { $in: docs.map((d) => d._id) } });
      results.push({ dataType: key, label: cfg.label, moved: docs.length });
    }

    const totalMoved = results.reduce((s, r) => s + r.moved, 0);
    res.status(200).json({
      status: "success",
      message:
        totalMoved > 0
          ? `${totalMoved} record(s) moved to Trash. They will be permanently removed after ${RETENTION_DAYS} days.`
          : "No matching records found to delete.",
      data: { scope, month, year, results, totalMoved, retentionDays: RETENTION_DAYS },
    });
  } catch (error) {
    console.error("deleteData error:", error);
    res.status(500).json({ status: "fail", message: error.message });
  }
};

// ── GET /admin/data/trash ────────────────────────────────────────────────
// Lists trash entries (newest first). Runs the lazy purge first so expired
// entries never appear. Document snapshots are omitted from the list payload.
exports.getTrash = async (req, res) => {
  try {
    await purgeExpiredTrash();

    const entries = await Trash.find()
      .select("-documents")
      .sort({ deletedAt: -1 })
      .lean();

    const items = entries.map((e) => {
      const daysLeft = Math.max(
        0,
        Math.ceil((new Date(e.expiresAt) - Date.now()) / (24 * 60 * 60 * 1000)),
      );
      return {
        _id: e._id,
        dataType: e.dataType,
        label: e.label,
        scope: e.scope,
        month: e.month || null,
        monthName: e.month ? MONTH_NAMES[e.month - 1] : null,
        year: e.year,
        period:
          e.scope === "month"
            ? `${MONTH_NAMES[e.month - 1]} ${e.year}`
            : `Year ${e.year}`,
        recordCount: e.recordCount,
        deletedAt: e.deletedAt,
        expiresAt: e.expiresAt,
        daysLeft,
        deletedBy: e.deletedBy,
      };
    });

    res.status(200).json({
      status: "success",
      data: { items, count: items.length, retentionDays: RETENTION_DAYS },
    });
  } catch (error) {
    console.error("getTrash error:", error);
    res.status(500).json({ status: "fail", message: error.message });
  }
};

// ── POST /admin/data/trash/:id/restore ────────────────────────────────────
// Re-inserts the snapshotted documents into their source collection, then
// deletes the trash entry. Duplicate-key conflicts (a record recreated in the
// meantime) are skipped and reported.
exports.restoreTrash = async (req, res) => {
  try {
    await purgeExpiredTrash();

    const entry = await Trash.findById(req.params.id);
    if (!entry) {
      return res
        .status(404)
        .json({ status: "fail", message: "Trash entry not found or already expired" });
    }

    const cfg = REGISTRY[entry.dataType];
    if (!cfg) {
      return res
        .status(400)
        .json({ status: "fail", message: `Unknown data type: ${entry.dataType}` });
    }

    let restored = 0;
    let skipped = 0;
    if (entry.documents.length) {
      try {
        // Raw insert preserves the original _id and bypasses re-running
        // pre-save hooks (which could recompute derived fields).
        const r = await cfg.model.collection.insertMany(entry.documents, {
          ordered: false,
        });
        restored = r.insertedCount || 0;
      } catch (bulkErr) {
        // Partial success: some docs conflicted (e.g. unique index). Count what
        // actually went in and treat the rest as skipped.
        restored = bulkErr.result?.insertedCount ?? bulkErr.insertedDocs?.length ?? 0;
        skipped = entry.documents.length - restored;
      }
    }

    await Trash.deleteOne({ _id: entry._id });

    res.status(200).json({
      status: "success",
      message: `Restored ${restored} record(s)${skipped ? `, ${skipped} skipped (already exist)` : ""}.`,
      data: { restored, skipped, dataType: entry.dataType, label: entry.label },
    });
  } catch (error) {
    console.error("restoreTrash error:", error);
    res.status(500).json({ status: "fail", message: error.message });
  }
};

// ── DELETE /admin/data/trash/:id ──────────────────────────────────────────
// Permanently removes a trash entry now (before its 10-day expiry).
exports.deleteTrashEntry = async (req, res) => {
  try {
    const entry = await Trash.findByIdAndDelete(req.params.id);
    if (!entry) {
      return res
        .status(404)
        .json({ status: "fail", message: "Trash entry not found" });
    }
    res.status(200).json({
      status: "success",
      message: `${entry.recordCount} record(s) permanently deleted.`,
    });
  } catch (error) {
    console.error("deleteTrashEntry error:", error);
    res.status(500).json({ status: "fail", message: error.message });
  }
};

// ── DELETE /admin/data/trash ──────────────────────────────────────────────
// Empties the whole trash permanently.
exports.emptyTrash = async (req, res) => {
  try {
    const r = await Trash.deleteMany({});
    res.status(200).json({
      status: "success",
      message: `Trash emptied. ${r.deletedCount} entr${r.deletedCount === 1 ? "y" : "ies"} permanently removed.`,
    });
  } catch (error) {
    console.error("emptyTrash error:", error);
    res.status(500).json({ status: "fail", message: error.message });
  }
};

exports.purgeExpiredTrash = purgeExpiredTrash;
