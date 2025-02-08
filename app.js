const express = require('express');
const i18n = require('./config/i18n');
const app = express();

// Initialize i18n
app.use(i18n.init);

// Add language middleware
app.use((req, res, next) => {
    // Get language from query, cookie, or browser
    const lang = req.query.lang || req.cookies.lang || req.acceptsLanguages(['en', 'es', 'fr', 'de', 'zh']);
    if (lang) {
        req.setLocale(lang);
        res.cookie('lang', lang, { maxAge: 365 * 24 * 60 * 60 * 1000 }); // Save for 1 year
    }
    next();
});

// ... rest of your app configuration 