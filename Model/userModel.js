const mongoose = require('mongoose');

const { Schema } = mongoose

const UserModel = new Schema({
    name: String,
    email: String,
    password: String,
    planTier: {
        type: Number,
        default: 1,
    },
    referrals: Number,
    accountBalance: {
        type: Number,
        default: 0,
    },
    referredBy: String,
    paidReferrals: {
        type: Number,
        default: 0,
    },
    totalInvestment: {
        type: Number,
        default: 0,
    },
    totalPaid: {
        type: Number,
        default: 0,
    },
    payout: {
        type: Number,
        default: 0,
    },
    bankInfo: {
        bank: String,
        accountNumber: String,
        accountName: String,
        bankCode: String,
    }
});

module.exports = mongoose.model('User', UserModel);