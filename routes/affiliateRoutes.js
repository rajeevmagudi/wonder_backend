const express = require('express');
const router = express.Router();
const { AffiliateProgram, AffiliateLink, AffiliateClick } = require('../models/affiliateModel');
const mongoose = require('mongoose');

// Middleware to check authentication (assuming it's passed or imported)
// For now, I'll rely on the server.js providing the middleware or define a simple one if needed.
// Actually, I should probably pass the authenticateToken middleware.

const affiliateRoutes = (authenticateToken, authenticateAdmin) => {

    // Get all affiliate programs
    router.get('/programs', authenticateToken, async (req, res) => {
        try {
            const programs = await AffiliateProgram.find({ isActive: true });
            res.json(programs);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching affiliate programs' });
        }
    });

    // Generate an affiliate link
    router.post('/generate-link', authenticateToken, async (req, res) => {
        try {
            const { programId } = req.body;
            const userId = req.user.userId;

            // Check if link already exists
            let affiliateLink = await AffiliateLink.findOne({ userId, programId });

            if (!affiliateLink) {
                // Generate a unique code
                const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                affiliateLink = new AffiliateLink({
                    userId,
                    programId,
                    code
                });
                await affiliateLink.save();
            }

            res.status(201).json(affiliateLink);
        } catch (error) {
            console.error('Error generating affiliate link:', error);
            res.status(500).json({ message: 'Error generating affiliate link' });
        }
    });

    // Record a click
    router.post('/record-click', async (req, res) => {
        try {
            const { code } = req.body;
            const affiliateLink = await AffiliateLink.findOne({ code });

            if (!affiliateLink) {
                return res.status(404).json({ message: 'Affiliate code not found' });
            }

            const click = new AffiliateClick({
                affiliateLinkId: affiliateLink._id,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });

            await click.save();

            // Increment click count on link
            affiliateLink.clicks += 1;
            await affiliateLink.save();

            res.status(200).json({ message: 'Click recorded', affiliateLinkId: affiliateLink._id });
        } catch (error) {
            console.error('Error recording click:', error);
            res.status(500).json({ message: 'Error recording click' });
        }
    });

    // My affiliate stats
    router.get('/my-stats', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.userId;
            const stats = await AffiliateLink.find({ userId }).populate('programId');
            res.json(stats);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching affiliate stats' });
        }
    });

    // Admin: Get all affiliate links
    router.get('/admin/all-links', authenticateAdmin, async (req, res) => {
        try {
            const links = await AffiliateLink.find()
                .populate('userId', 'username email')
                .populate('programId');
            res.json(links);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching all affiliate links' });
        }
    });

    return router;
};

module.exports = affiliateRoutes;
