const mongoose = require("mongoose");

// Recycle bin for month/year-wise data deletions performed from the HRM
// Settings page. Instead of touching every source model with an `isDeleted`
// flag, a delete operation snapshots the matching documents into this
// collection and removes them from their source collection. Each Trash entry
// covers ONE data type from ONE delete operation (e.g. "Attendance —
// September 2025 — 45 records").
//
// Auto-removal after 10 days is handled two ways for robustness:
//  1. A TTL index on `expiresAt` — MongoDB purges expired entries in the
//     background (~every 60s) with no cron/infra needed.
//  2. A lazy purge safeguard that runs whenever the trash is read (see
//     dataManagementController.purgeExpiredTrash).
const trashSchema = new mongoose.Schema(
  {
    // Registry key from dataManagementController (e.g. "attendance", "payroll")
    dataType: { type: String, required: true, index: true },
    // Mongoose model name the documents belong to (e.g. "Attendance")
    sourceModel: { type: String, required: true },
    // Human-readable label shown in the UI (e.g. "Attendance")
    label: { type: String, required: true },

    // "month" (specific month+year) or "year" (whole year)
    scope: { type: String, enum: ["month", "year"], required: true },
    month: { type: Number, min: 1, max: 12 }, // null for year scope
    year: { type: Number, required: true },

    recordCount: { type: Number, default: 0 },
    // Full snapshots of the deleted documents (raw, so restore is exact)
    documents: { type: [mongoose.Schema.Types.Mixed], default: [] },

    deletedAt: { type: Date, default: Date.now },
    // deletedAt + 10 days — TTL index below purges the doc once this passes
    expiresAt: { type: Date, required: true },

    deletedBy: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: String,
      email: String,
    },
  },
  { timestamps: true },
);

// TTL index: MongoDB deletes the document once `expiresAt` is in the past.
trashSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Trash", trashSchema);
