const SiteSettings = require("../models/SiteSettings");

/**
 * Public: return the current site settings. The public marketing site calls
 * this to render the logo, favicon, contact info and social links.
 */
const getSiteSettings = async (req, res) => {
  try {
    const settings = await SiteSettings.getSingleton();
    return res.status(200).json({ success: true, settings });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch site settings",
      error: error.message,
    });
  }
};

/**
 * Admin/Moderator: update the singleton settings document. Only the fields
 * present in the request body are changed.
 */
const updateSiteSettings = async (req, res) => {
  try {
    const settings = await SiteSettings.getSingleton();

    const {
      siteName,
      tagline,
      description,
      siteUrl,
      logo,
      logoPublicId,
      favicon,
      faviconPublicId,
      email,
      phone,
      address,
      latitude,
      longitude,
      social,
    } = req.body;

    if (siteName !== undefined) settings.siteName = siteName;
    if (tagline !== undefined) settings.tagline = tagline;
    if (description !== undefined) settings.description = description;
    if (siteUrl !== undefined) settings.siteUrl = siteUrl;
    if (logo !== undefined) settings.logo = logo;
    if (logoPublicId !== undefined) settings.logoPublicId = logoPublicId;
    if (favicon !== undefined) settings.favicon = favicon;
    if (faviconPublicId !== undefined)
      settings.faviconPublicId = faviconPublicId;
    if (email !== undefined) settings.email = email;
    if (phone !== undefined) settings.phone = phone;
    if (address !== undefined) settings.address = address;
    if (latitude !== undefined && latitude !== "")
      settings.latitude = Number(latitude);
    if (longitude !== undefined && longitude !== "")
      settings.longitude = Number(longitude);

    if (social && typeof social === "object") {
      settings.social = {
        facebook:
          social.facebook !== undefined
            ? social.facebook
            : settings.social?.facebook || "",
        twitter:
          social.twitter !== undefined
            ? social.twitter
            : settings.social?.twitter || "",
        linkedin:
          social.linkedin !== undefined
            ? social.linkedin
            : settings.social?.linkedin || "",
        instagram:
          social.instagram !== undefined
            ? social.instagram
            : settings.social?.instagram || "",
        youtube:
          social.youtube !== undefined
            ? social.youtube
            : settings.social?.youtube || "",
      };
    }

    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Site settings updated successfully",
      settings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update site settings",
      error: error.message,
    });
  }
};

module.exports = { getSiteSettings, updateSiteSettings };
