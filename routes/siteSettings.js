const express = require("express");
const {
  authMiddleware,
  requireAdminOrModerator,
} = require("../middleware/auth");
const {
  getSiteSettings,
  updateSiteSettings,
} = require("../controllers/siteSettingsController");

const router = express.Router();

// Public: the marketing site reads settings here.
router.get("/", getSiteSettings);

// Admin/Moderator: update settings from the dashboard.
router.put("/", authMiddleware, requireAdminOrModerator, updateSiteSettings);

module.exports = router;
