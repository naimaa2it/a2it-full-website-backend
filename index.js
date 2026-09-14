require("dotenv").config();
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");

// Import routes
const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const servicesRoutes = require("./routes/services");
const serviceCategoriesRoutes = require("./routes/serviceCategories");
const servicePageContentRoutes = require("./routes/servicePageContent");
const portfolioRoutes = require("./routes/portfolio");
const portfolioCategoriesRoutes = require("./routes/portfolioCategories");
const promotionalProjectsRoutes = require("./routes/promotionalProjects");
const promotionalProjectCategoriesRoutes = require("./routes/promotionalProjectCategories");
const promotionalPackagesRoutes = require("./routes/promotionalPackages");
const employeesRoutes = require("./routes/employees");
const rolesRoutes = require("./routes/roles");
const blogRoutes = require("./routes/blog");
const uploadRoutes = require("./routes/upload");
const clientLogosRoutes = require("./routes/clientLogos");
const siteSettingsRoutes = require("./routes/siteSettings");

// HRM module (merged) — everything under /api/v1
const hrmRoutes = require("./hrm/routes/api");
const { initHrm } = require("./hrm/bootstrap");

const app = express();

// Enhanced middleware setup
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "https://a2itltd.com",
      "https://www.a2itltd.com",
      "http://localhost:5000",
      "https://a2it-dashboard-backend.vercel.app",
      "https://marvelous-longma-1f45a1.netlify.app",
    ],
    methods: ["POST", "GET", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Connect to MongoDB (single database for both the website and HRM),
// then start the HRM background jobs.
connectDB().then(() => {
  initHrm().catch((err) =>
    console.error("❌ [HRM] bootstrap failed:", err.message),
  );
});

// Parse various content types with increased limits
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Root route for testing
app.get("/", (req, res) => {
  res.json({
    message: "API is running",
    status: "active",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    endpoints: {
      test: "/api/test",
      sendEmail: "/api/send-email (POST)",
      website: "Website/CMS routes are prefixed with /api",
      hrm: "HRM routes are prefixed with /api/v1",
    },
  });
});

// Test endpoint
app.get("/api/test", (req, res) => {
  res.json({
    message: "API is working!",
    timestamp: new Date().toISOString(),
    endpoints: {
      sendEmail: "/api/send-email (POST)",
      test: "/api/test (GET)",
    },
  });
});

// Email endpoint
app.post("/api/send-email", async (req, res) => {
  try {
    // Check if body exists
    if (!req.body || Object.keys(req.body).length === 0) {
      console.log("❌ Empty request body received");
      return res.status(400).json({
        error: "Request body is empty",
        message: "Please provide the required fields in the request body",
      });
    }

    const { name, email, phone, message, type, subject, model, shippingTerm } =
      req.body;

    // Log received data for debugging
    console.log("📨 Received inquiry data:", {
      type,
      model,
      shippingTerm,
      name,
      email,
      phone,
      message: message ? message.substring(0, 50) + "..." : "No message",
    });

    // Validate required fields
    if (!name || !email || !phone) {
      console.log("❌ Missing required fields:", { name, email, phone });
      return res.status(400).json({
        error: "Missing required fields",
        received: { name: !!name, email: !!email, phone: !!phone },
        required: ["name", "email", "phone"],
      });
    }

    // Check for missing SMTP credentials
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.error("❌ SMTP credentials missing in environment variables");
      return res.status(500).json({
        error: "Server configuration error",
        message: "Email service not properly configured",
      });
    }

    // Nodemailer transporter with Hostinger SMTP
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.hostinger.com",
      port: parseInt(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Verify SMTP connection
    await transporter.verify();
    console.log("✅ SMTP connection verified");

    let emailSubject, textContent, htmlContent;

    // Check for product inquiry (case insensitive)
    if (type && type.toLowerCase() === "product_inquiry") {
      // Set default values if model or shippingTerm are missing
      const planModel = model || "Not specified";
      const planDetails = shippingTerm || "Not specified";

      // Create subject with plan info
      emailSubject =
        subject || `🔔 New PRODUCT: ${planModel} Interested - 70% OFF ELIGIBLE`;

      textContent = `
      🔔 NEW PRODUCT INQUIRY - 70% OFF ELIGIBLE 
      ================================
      Selected Plan: ${planModel}
      Plan Details: ${planDetails}

      CUSTOMER DETAILS:
      ----------------
      Name: ${name}
      Email: ${email}
      Phone: ${phone}

      PROJECT DESCRIPTION:
      -------------------
      ${message || "No project description provided"}

      ================================
            `;

      htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Consultation Inquiry</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f7f7f7;">
        <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 20px rgba(0,0,0,0.1);">
          
          <!-- Header with gradient and pattern -->
          <div style="background: linear-gradient(135deg, #7e602c 0%, #f5b342 100%); padding: 40px 30px; text-align: center; position: relative;">
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: radial-gradient(circle at 30px 30px, rgba(255,255,255,0.1) 2px, transparent 2px); background-size: 30px 30px;"></div>
            
            <div style="position: relative; z-index: 1;">
              <div style="display: inline-block; background: rgba(255,255,255,0.2); backdrop-filter: blur(5px); color: white; font-size: 14px; font-weight: bold; padding: 8px 20px; border-radius: 50px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.3);">
                🚀 NEW CONSULTATION REQUEST
              </div>
              <h1 style="color: white; margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.5px; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                ${name} wants to<br>activate 70% OFF!
              </h1>
            </div>
          </div>

          <!-- Content -->
          <div style="padding: 40px 30px;">
            
            <!-- Plan Details Card -->
            <div style="background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border: 1px solid #e0e0e0; border-radius: 16px; padding: 25px; margin-bottom: 30px; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">
              <h3 style="margin: 0 0 20px 0; color: #333; font-size: 18px; display: flex; align-items: center; gap: 10px;">
                <span style="background: #f5b342; color: white; width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;">🎯</span>
                Selected Plan Details
              </h3>
              
              <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #eaeaea;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 2px dashed #f0f0f0;">
                  <span style="font-size: 14px; color: #666;">Plan Name</span>
                  <span style="font-size: 18px; font-weight: 800; color: #f5b342;">${planModel}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 14px; color: #666;">Full Details</span>
                  <span style="font-size: 14px; color: #333; text-align: right; max-width: 60%;">${planDetails}</span>
                </div>
              </div>
            </div>

            <!-- Customer Information Card -->
            <div style="background: #f8f9fa; border-radius: 16px; padding: 25px; margin-bottom: 30px; border: 1px solid #eaeaea;">
              <h3 style="margin: 0 0 20px 0; color: #333; font-size: 18px; display: flex; align-items: center; gap: 10px;">
                <span style="background: #7e602c; color: white; width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;">👤</span>
                Customer Information
              </h3>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #eaeaea; color: #666; width: 35%; font-weight: 500;">Full Name:</td>
                  <td style="padding: 12px; border-bottom: 1px solid #eaeaea; color: #333; font-weight: 600;">${name}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #eaeaea; color: #666; font-weight: 500;">Email:</td>
                  <td style="padding: 12px; border-bottom: 1px solid #eaeaea;">
                    <a href="mailto:${email}" style="color: #f5b342; text-decoration: none; font-weight: 600;">${email}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px; color: #666; font-weight: 500;">Phone:</td>
                  <td style="padding: 12px;">
                    <a href="tel:${phone}" style="color: #f5b342; text-decoration: none; font-weight: 600;">${phone}</a>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Project Description Card -->
            <div style="background: #f8f9fa; border-radius: 16px; padding: 25px; margin-bottom: 30px; border: 1px solid #eaeaea;">
              <h3 style="margin: 0 0 20px 0; color: #333; font-size: 18px; display: flex; align-items: center; gap: 10px;">
                <span style="background: #f5b342; color: white; width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;">📝</span>
                Project Description
              </h3>
              <div style="background: white; border-radius: 12px; padding: 20px; line-height: 1.8; color: #333; font-size: 15px;">
                ${message || "No project description provided"}
              </div>
            </div>

            <!-- Action Buttons -->
            <div style="text-align: center; margin: 40px 0 20px;">
              <a href="mailto:${email}" style="display: inline-block; background: #f5b342; color: white; text-decoration: none; padding: 15px 35px; border-radius: 50px; margin: 0 10px 10px 0; font-weight: 600; font-size: 15px; box-shadow: 0 4px 10px rgba(245, 179, 66, 0.3);">
                📧 Reply via Email
              </a>
              <a href="tel:${phone}" style="display: inline-block; background: #7e602c; color: white; text-decoration: none; padding: 15px 35px; border-radius: 50px; margin: 0 10px 10px 0; font-weight: 600; font-size: 15px; box-shadow: 0 4px 10px rgba(126, 96, 44, 0.3);">
                📞 Call Customer
              </a>
            </div>

            <!-- Footer -->
            <div style="margin-top: 40px; padding-top: 20px; text-align: center; border-top: 2px solid #eaeaea; color: #999; font-size: 13px;">
              <p style="margin: 5px 0;">This inquiry was sent from the consultation modal on your website.</p>
              <p style="margin: 5px 0;">Received: ${new Date().toLocaleString()}</p>
              <p style="margin: 15px 0 0 0;">© ${new Date().getFullYear()} A2ITLD. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
      `;
    } else if (type && type.toLowerCase() === "banner_inquiry") {
      // Banner inquiry from hero section
      const selectedPackage = model || "Not specified";
      const packageDetails = shippingTerm || "Not specified";
      const projectDesc = message || "No project description provided";

      // Create subject with package info
      emailSubject =
        subject ||
        `🎯 NEW PRODUCT INQUIRY: ${selectedPackage} Interested - 50% OFF ELIGIBLE`;

      textContent = `
      🔔 NEW PRODUCT INQUIRY - 50% OFF ELIGIBLE
      ==========================================
      Source: Hero Section Banner Form
      Time: ${new Date().toLocaleString()}

      SELECTED PACKAGE:
      ----------------
      Package: ${selectedPackage}
      Package Details: ${packageDetails}

      CUSTOMER DETAILS:
      ----------------
      Name: ${name}
      Email: ${email}
      Phone: ${phone}

      PROJECT DESCRIPTION:
      -------------------
      ${projectDesc}

      ==========================================
      This customer is eligible for 50% discount on website package!
            `;

      htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Banner Inquiry</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        </style>
      </head>
      <body style="font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0; background-color: #0a192f;">
        <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
          
          <!-- Header with gradient -->
          <div style="background: linear-gradient(135deg, #0a192f 0%, #1a2f4f 100%); padding: 40px 30px; text-align: center; position: relative;">
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: url('data:image/svg+xml,<svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><path d="M30 5 L55 20 L55 40 L30 55 L5 40 L5 20 L30 5" fill="none" stroke="rgba(245,179,66,0.1)" stroke-width="1"/></svg>') repeat; opacity: 0.2;"></div>
            
            <div style="position: relative; z-index: 1;">
              <!-- 50% OFF Badge -->
              <div style="display: inline-block; background: #f5b342; color: #0a192f; font-size: 14px; font-weight: 800; padding: 8px 24px; border-radius: 50px; margin-bottom: 20px; transform: rotate(-2deg); box-shadow: 0 4px 10px rgba(245,179,66,0.3);">
                ⚡ 50% OFF ELIGIBLE ⚡
              </div>
              
              <h1 style="color: white; margin: 10px 0; font-size: 36px; font-weight: 800; letter-spacing: -1px;">
                New Banner Inquiry!
              </h1>
              <p style="color: #f5b342; margin: 0; font-size: 18px; font-weight: 600;">
                ${selectedPackage}
              </p>
            </div>
          </div>

          <!-- Content -->
          <div style="padding: 40px 30px;">
            
            <!-- Package Card -->
            <div style="background: linear-gradient(135deg, #fff8e7 0%, #ffffff 100%); border: 2px solid #f5b342; border-radius: 20px; padding: 25px; margin-bottom: 30px; box-shadow: 0 10px 25px rgba(245,179,66,0.1);">
              <h3 style="margin: 0 0 20px 0; color: #0a192f; font-size: 20px; display: flex; align-items: center; gap: 10px;">
                <span style="background: #f5b342; color: #0a192f; width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🎯</span>
                Selected Package
              </h3>
              
              <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #eaeaea;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 2px dashed #f0f0f0;">
                  <span style="font-size: 14px; color: #666;">Package Name</span>
                  <span style="font-size: 18px; font-weight: 800; color: #f5b342;">${selectedPackage}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 14px; color: #666;">Details</span>
                  <span style="font-size: 14px; color: #333; text-align: right; max-width: 60%;">${packageDetails}</span>
                </div>
              </div>
            </div>

            <!-- Customer Details -->
            <div style="background: #f8f9fa; border-radius: 16px; padding: 25px; margin-bottom: 30px;">
              <h3 style="margin: 0 0 20px 0; color: #0a192f; font-size: 18px; display: flex; align-items: center; gap: 10px;">
                <span style="background: #0a192f; color: white; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">👤</span>
                Customer Information
              </h3>
              
              <div style="background: white; border-radius: 12px; padding: 20px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Name:</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; color: #0a192f; font-weight: 600;">${name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">Email:</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">
                      <a href="mailto:${email}" style="color: #f5b342; text-decoration: none; font-weight: 600;">${email}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; color: #666;">Phone:</td>
                    <td style="padding: 10px;">
                      <a href="tel:${phone}" style="color: #f5b342; text-decoration: none; font-weight: 600;">${phone}</a>
                    </td>
                  </tr>
                </table>
              </div>
            </div>

            <!-- Project Description -->
            ${
              projectDesc !== "No project description provided"
                ? `
            <div style="background: #f8f9fa; border-radius: 16px; padding: 25px; margin-bottom: 30px;">
              <h3 style="margin: 0 0 20px 0; color: #0a192f; font-size: 18px; display: flex; align-items: center; gap: 10px;">
                <span style="background: #f5b342; color: #0a192f; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">📝</span>
                Project Description
              </h3>
              <div style="background: white; border-radius: 12px; padding: 20px; line-height: 1.6; color: #333;">
                ${projectDesc}
              </div>
            </div>
            `
                : ""
            }

            <!-- Quick Actions -->
            <div style="display: flex; gap: 15px; justify-content: center; margin: 30px 0;">
              <a href="mailto:${email}" style="background: #f5b342; color: #0a192f; text-decoration: none; padding: 15px 30px; border-radius: 12px; font-weight: 600; font-size: 14px; display: inline-flex; align-items: center; gap: 8px;">
                📧 Reply via Email
              </a>
              <a href="tel:${phone}" style="background: #0a192f; color: white; text-decoration: none; padding: 15px 30px; border-radius: 12px; font-weight: 600; font-size: 14px; display: inline-flex; align-items: center; gap: 8px;">
                📞 Call Now
              </a>
            </div>

            <!-- Footer -->
            <div style="margin-top: 30px; padding-top: 20px; text-align: center; border-top: 2px solid #eaeaea;">
              <div style="display: inline-block; background: #f5b342; color: #0a192f; font-size: 12px; font-weight: 600; padding: 5px 15px; border-radius: 50px; margin-bottom: 10px;">
                Hero Section Banner Form
              </div>
              <p style="color: #999; font-size: 12px; margin: 5px 0;">
                Received: ${new Date().toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
            `;
    } else if (type && type.toLowerCase() === "footer_inquiry") {
      // Footer consultation form inquiry
      emailSubject =
        subject || `📞 NEW CONSULTATION: ${name} - Free Consultation Request`;

      textContent = `
      📞 NEW CONSULTATION REQUEST
      ==========================================
      Source: Footer Contact Form
      Time: ${new Date().toLocaleString()}

      CONSULTATION DETAILS:
      -------------------
      Type: Free Website Consultation
      Response Time: Within 2 hours

      CUSTOMER DETAILS:
      ----------------
      Name: ${name}
      Email: ${email}
      Phone: ${phone}

      PROJECT DESCRIPTION:
      -------------------
      ${message || "No project description provided"}

      ==========================================
      This customer requested a free consultation from the footer form.
            `;

      htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Footer Consultation Request</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        </style>
      </head>
      <body style="font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0; background: linear-gradient(135deg, #0a192f 0%, #1a1f2f 100%);">
        <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.3);">
          
          <!-- Header with gradient -->
          <div style="background: linear-gradient(135deg, #f97316 0%, #dc2626 100%); padding: 40px 30px; text-align: center; position: relative;">
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: url('data:image/svg+xml,<svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="30" r="5" fill="rgba(255,255,255,0.1)"/></svg>') repeat; opacity: 0.2;"></div>
            
            <div style="position: relative; z-index: 1;">
              <!-- Free Consultation Badge -->
              <div style="display: inline-block; background: rgba(255,255,255,0.2); backdrop-filter: blur(5px); color: white; font-size: 14px; font-weight: 800; padding: 8px 24px; border-radius: 50px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.3);">
                ⚡ FREE CONSULTATION REQUEST ⚡
              </div>
              
              <h1 style="color: white; margin: 10px 0; font-size: 36px; font-weight: 800; letter-spacing: -1px;">
                New Footer Inquiry!
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 18px;">
                ${name} wants to discuss a project
              </p>
            </div>
          </div>

          <!-- Content -->
          <div style="padding: 40px 30px;">
            
            <!-- Quick Response Badge -->
            <div style="background: linear-gradient(135deg, #f97316 0%, #dc2626 100%); border-radius: 16px; padding: 20px; margin-bottom: 30px; text-align: center;">
              <div style="display: inline-flex; align-items: center; gap: 10px; background: white; padding: 8px 20px; border-radius: 50px;">
                <span style="color: #f97316; font-weight: 600; font-size: 14px;">⏱️ Response within 2 hours</span>
              </div>
            </div>
            
            <!-- Customer Details Card -->
            <div style="background: #f8f9fa; border-radius: 20px; padding: 30px; margin-bottom: 30px; border: 1px solid #eaeaea;">
              <h3 style="margin: 0 0 25px 0; color: #0a192f; font-size: 20px; display: flex; align-items: center; gap: 10px;">
                <span style="background: #f97316; color: white; width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center;">👤</span>
                Customer Information
              </h3>
              
              <div style="display: grid; gap: 15px;">
                <div style="background: white; border-radius: 12px; padding: 15px; border: 1px solid #eaeaea;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 32px; height: 32px; background: #f97316; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                      <span style="color: white; font-weight: 600;">👤</span>
                    </div>
                    <div>
                      <div style="font-size: 12px; color: #666;">Full Name</div>
                      <div style="font-size: 16px; font-weight: 600; color: #0a192f;">${name}</div>
                    </div>
                  </div>
                </div>
                
                <div style="background: white; border-radius: 12px; padding: 15px; border: 1px solid #eaeaea;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 32px; height: 32px; background: #f97316; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                      <span style="color: white; font-weight: 600;">📧</span>
                    </div>
                    <div>
                      <div style="font-size: 12px; color: #666;">Email Address</div>
                      <a href="mailto:${email}" style="font-size: 16px; font-weight: 600; color: #f97316; text-decoration: none;">${email}</a>
                    </div>
                  </div>
                </div>
                
                <div style="background: white; border-radius: 12px; padding: 15px; border: 1px solid #eaeaea;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 32px; height: 32px; background: #f97316; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                      <span style="color: white; font-weight: 600;">📞</span>
                    </div>
                    <div>
                      <div style="font-size: 12px; color: #666;">Phone Number</div>
                      <a href="tel:${phone}" style="font-size: 16px; font-weight: 600; color: #f97316; text-decoration: none;">${phone}</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Project Description -->
            <div style="background: #f8f9fa; border-radius: 20px; padding: 30px; margin-bottom: 30px; border: 1px solid #eaeaea;">
              <h3 style="margin: 0 0 20px 0; color: #0a192f; font-size: 18px; display: flex; align-items: center; gap: 10px;">
                <span style="background: #f97316; color: white; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">📝</span>
                Project Details
              </h3>
              <div style="background: white; border-radius: 12px; padding: 20px; line-height: 1.6; color: #333; font-size: 15px; border: 1px solid #eaeaea;">
                ${message || "No project description provided"}
              </div>
            </div>

            <!-- Action Buttons -->
            <div style="display: flex; gap: 15px; justify-content: center; margin: 30px 0;">
              <a href="mailto:${email}" style="background: #f97316; color: white; text-decoration: none; padding: 15px 30px; border-radius: 12px; font-weight: 600; font-size: 14px; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 10px 20px rgba(249,115,22,0.3);">
                📧 Reply via Email
              </a>
              <a href="tel:${phone}" style="background: #0a192f; color: white; text-decoration: none; padding: 15px 30px; border-radius: 12px; font-weight: 600; font-size: 14px; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 10px 20px rgba(10,25,47,0.3);">
                📞 Call Now
              </a>
            </div>

            <!-- Footer -->
            <div style="margin-top: 30px; padding-top: 20px; text-align: center; border-top: 2px solid #eaeaea;">
              <div style="display: inline-block; background: #f97316; color: white; font-size: 12px; font-weight: 600; padding: 5px 15px; border-radius: 50px; margin-bottom: 10px;">
                Footer Consultation Form
              </div>
              <p style="color: #999; font-size: 12px; margin: 5px 0;">
                Received: ${new Date().toLocaleString()}
              </p>
              <p style="color: #999; font-size: 11px;">
                This customer requested a free consultation from the website footer.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
            `;
    } else {
      // General inquiry (from ContactPage)
      emailSubject = subject || "New Inquiry from Website";
      textContent = `
      NEW INQUIRY
      ================
      Customer Details:
      Name: ${name}
      Email: ${email}
      Phone: ${phone || "Not provided"}

      ----------------------------
      Customer Message:
      ${message || "No message provided"}
      ================
            `;

      htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #e67e22; border-bottom: 2px solid #e67e22; padding-bottom: 5px;">
          GENERAL INQUIRY
        </h2>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="background: #e67e22; color: white;">
            <th colspan="2" style="padding: 10px; text-align: left;">CUSTOMER DETAILS</th>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; width: 30%;"><strong>Name:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${name}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Email:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${email}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Phone:</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${phone || "Not provided"}</td>
          </tr>
        </table>

        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
          <h4 style="margin-top: 0; color: #e67e22;">CUSTOMER MESSAGE:</h4>
          <p style="white-space: pre-wrap; margin-bottom: 0;">${message || "No message provided"}</p>
        </div>
      </div>
            `;
    }

    // Send email
    const mailOptions = {
      from: `"Website Inquiry" <${process.env.SMTP_USER}>`,
      to: process.env.OWNER_EMAIL,
      subject: emailSubject,
      text: textContent,
      html: htmlContent,
    };

    console.log("📤 Sending email to:", process.env.OWNER_EMAIL);
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.messageId);

    res.status(200).json({
      success: true,
      message: "Email sent successfully",
      messageId: info.messageId,
    });
  } catch (error) {
    console.error("❌ Error sending email:", error);
    res.status(500).json({
      error: "Failed to send email",
      details: error.message,
    });
  }
});

// ============================================
// API Routes
// ============================================

// Authentication routes
app.use("/api/auth", authRoutes);

// User management routes (Admin only)
app.use("/api/users", usersRoutes);

// Blog routes
app.use("/api/blog", blogRoutes);

// Services routes
app.use("/api/services", servicesRoutes);

// Service category routes
app.use("/api/service-categories", serviceCategoriesRoutes);

// Service page editable content routes
app.use("/api/service-content", servicePageContentRoutes);

// Portfolio routes
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/portfolio-categories", portfolioCategoriesRoutes);

// Promotional content routes
app.use("/api/promotional-projects", promotionalProjectsRoutes);
app.use(
  "/api/promotional-project-categories",
  promotionalProjectCategoriesRoutes,
);
app.use("/api/promotional-packages", promotionalPackagesRoutes);

// Employee routes (public + admin)
app.use("/api/employees", employeesRoutes);

// Roles routes
app.use("/api/roles", rolesRoutes);

// Upload routes (auth)
app.use("/api/upload", uploadRoutes);

// Client showcase logo routes
app.use("/api/client-logos", clientLogosRoutes);

// Site-wide settings (logo, favicon, contact info, social links)
app.use("/api/site-settings", siteSettingsRoutes);

// ============================================
// HRM API Routes (merged HRM system)
// ============================================
app.use("/api/v1", hrmRoutes);

// ============================================
// End API Routes
// ============================================

// Error handling middleware (must be after all routes and middleware)
app.use(errorHandler);

// 404 handler - Must be after all routes
app.use((req, res) => {
  console.log("404 Not Found:", req.method, req.path);
  res.status(404).json({
    error: "Route not found",
    path: req.path,
    method: req.method,
    message: "The requested endpoint does not exist",
  });
});

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📝 Test endpoint:   http://localhost:${PORT}/api/test`);
    console.log(`🌐 Website API:     http://localhost:${PORT}/api/...`);
    console.log(`👥 HRM API:         http://localhost:${PORT}/api/v1/...\n`);
  });
}

// Export for Vercel serverless
module.exports = app;
