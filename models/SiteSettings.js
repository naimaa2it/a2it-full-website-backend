const mongoose = require("mongoose");

/**
 * Site-wide settings (a single "singleton" document).
 *
 * Holds the website identity/contact info that used to be hard-coded across
 * the frontend (logo, favicon, site name/url, contact email/phone, address,
 * social links). The public site reads these from GET /api/site-settings and
 * admins edit them from the dashboard "Website Info" page.
 */
const siteSettingsSchema = new mongoose.Schema(
  {
    // Identity
    siteName: { type: String, trim: true, default: "A2IT Ltd" },
    tagline: { type: String, trim: true, default: "Build Your Dreams" },
    description: {
      type: String,
      trim: true,
      default: "Transforming ideas into digital reality.",
    },
    siteUrl: { type: String, trim: true, default: "https://a2itltd.com" },

    // Branding assets (Cloudinary URLs)
    logo: { type: String, trim: true, default: "" },
    logoPublicId: { type: String, trim: true, default: "" },
    favicon: { type: String, trim: true, default: "" },
    faviconPublicId: { type: String, trim: true, default: "" },

    // Contact
    email: { type: String, trim: true, default: "info@a2itltd.com" },
    phone: { type: String, trim: true, default: "+880 1846-937397" },
    address: {
      type: String,
      trim: true,
      default: "Plot No 470\nRoad No 06\nDOHS Mirpur, Dhaka",
    },

    // Social links
    social: {
      facebook: {
        type: String,
        trim: true,
        default: "https://www.facebook.com/A2ITLtd",
      },
      twitter: { type: String, trim: true, default: "" },
      linkedin: {
        type: String,
        trim: true,
        default: "https://www.linkedin.com/in/a2itlimited/",
      },
      instagram: { type: String, trim: true, default: "" },
      youtube: { type: String, trim: true, default: "" },
    },

    // Marker so we always operate on the same single document.
    singleton: { type: String, default: "main", unique: true, immutable: true },
  },
  { timestamps: true },
);

/**
 * Always return the one-and-only settings document, creating it (with the
 * schema defaults) the first time it is requested.
 */
siteSettingsSchema.statics.getSingleton = async function () {
  let settings = await this.findOne({ singleton: "main" });
  if (!settings) {
    settings = await this.create({ singleton: "main" });
  }
  return settings;
};

module.exports = mongoose.model("SiteSettings", siteSettingsSchema);
