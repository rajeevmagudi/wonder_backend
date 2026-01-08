const mongoose = require('mongoose');

const affiliateProgramSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    commissionRate: { type: Number, default: 0 }, // e.g., percentage or flat amount
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

const affiliateLinkSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    programId: { type: mongoose.Schema.Types.ObjectId, ref: 'AffiliateProgram' },
    code: { type: String, required: true, unique: true },
    clicks: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    earnings: { type: Number, default: 0 },
}, { timestamps: true });

const affiliateClickSchema = new mongoose.Schema({
    affiliateLinkId: { type: mongoose.Schema.Types.ObjectId, ref: 'AffiliateLink', required: true },
    ip: { type: String },
    userAgent: { type: String },
    referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // If they sign up
    status: { type: String, enum: ['clicked', 'signed_up', 'purchased'], default: 'clicked' },
}, { timestamps: true });

const AffiliateProgram = mongoose.model('AffiliateProgram', affiliateProgramSchema);
const AffiliateLink = mongoose.model('AffiliateLink', affiliateLinkSchema);
const AffiliateClick = mongoose.model('AffiliateClick', affiliateClickSchema);

module.exports = { AffiliateProgram, AffiliateLink, AffiliateClick };
