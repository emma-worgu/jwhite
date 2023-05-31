const route = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Flutterwave = require('flutterwave-node-v3');
const axios = require('axios');

const UserModel = require('../Model/userModel');
const { UserAuthMiddleware } = require('../Middlewares/authMiddlewares');

route.post('/register', async (req, res) => {
    try {
        const emailExist = await UserModel.findOne({ email: req.body.email });
        const referrals = req.body.referralCode;

        console.log(referrals);

        if(emailExist) {
            return res.status(400).json({
                msg: 'Email is Already is use',
            });
        }

        // Get the referral code and check if the user exist
        if(referrals !== '') {
            let user;
            user = await UserModel.findById(referrals);
            if(user) {
                console.log(user);
                updateReferralCount = await UserModel.findByIdAndUpdate(user._id, {
                    referrals: user.referrals + 1,
                    payout: user.payout + user.accountBalance,
                });

                updateReferralCount.save();
            } else {
                return res.status(404).json({
                    msg: 'User with the referral code not found',
                });
            }
        };

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(req.body.password, salt);

        const user = new UserModel({
            name: req.body.name,
            email: req.body.email,
            password: hashedPassword,
            referredBy: referrals,
        });

        const token = jwt.sign({ _id: user._id }, process.env.UserToken, { expiresIn: '24h' });
        res.header('auth-token', token);

        user.save();

        return res.status(200).json({
            token,
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            msg: 'Bad Request',
        });
    }
});

route.post('/login', async (req, res) => {
    try {

        console.log(req.body);
        const emailExist = await UserModel.findOne({ email: req.body.email });

        if(!emailExist) {
            console.log('true');
            return res.status(404).json({
                msg: 'Incorrect Credentials'
            });
        }

        const validPassword = await bcrypt.compare(req.body.password, emailExist.password);
        console.log(validPassword);
        if (!validPassword) {
        return res.status(400).json({ msg: 'Incorrect Credentials!!'});
        }

        const token = jwt.sign({ _id: emailExist._id }, process.env.UserToken, { expiresIn: '24h' });
        res.header('auth-token', token);

        return res.status(200).json({
            token,
        });
    } catch (error) {
        console.log(error);
    }
});

route.get('/', UserAuthMiddleware, async (req, res) => {
    console.log(req.user);
    try {
        const user = await UserModel.findById(req.user);

        return res.status(200).json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                accountbalance: user.accountBalance,
                referrals: user.referrals,
                planTier: user.planTier,
            }
        });
    } catch (error) {
        console.log(error);
    }
});

route.post('/withdraw', UserAuthMiddleware, async (req, res) => {
    const user = await UserModel.findById(req.user);
    const { bank, amount, accountNumber } = req.body;

    // Enable withdrawal once the paid friends reaches 5
    if(user.paidReferrals < 5) {
        return res.status(403).json({
            msg: 'Invite more Friends to unlock withdrawal'
        });
    }

    if(user.payout === 0) {
        return res.status(400).json({
            msg: 'Insufficient Funds'
        });
    }

    if(amount > user.payout) {
        return res.status(400).json({
            msg: 'Insufficient Funds'
        });
    }


    try {
        // Generate the transaction reference.
        const trxref = `golden_investment_exchange-${user._id}-${Date.now()}`


        const body = {
            account_bank: bank,
            account_number: accountNumber,
            amount: amount,
            narration: "Golden Investment Exchange",
            currency: "NGN",
            reference: trxref,
            debit_currency: "NGN"
        }

        const data = JSON.stringify(body);

        const options = {
            method: 'POST',
            url: 'https://api.flutterwave.com/v3/transfers',
            data,
            headers: {
                'Content-Type': 'application/json',
                Authorization: process.env.FLW_SECRET_KEY,
            },
        };

        const response  = await axios(options);
        console.log(response);

        const updatedUser = await UserModel.findByIdAndUpdate(user._id, {
            paidReferrals: 0,
            accountBalance: 0,
            payout: user.payout - amount,
            totalPaid: user.totalPaid + amount,
        });

        updatedUser.save();

        return res.status(200).json({
            msg: 'success'
        });
        

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            msg: 'Something went wrong',
        });
        // console.log(error);
    }

    // return res.status(200).json({
    //     msg: 'Success'
    // });
});

route.post('/bank-verification', async (req, res) => {
    const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);

    console.log(req.body);

    const details = {
        account_number: req.body.accountNumber,
        account_bank: req.body.bank,
    };

    // Async and Await
    const result = await flw.Misc.verify_Account(details);

    console.log(result);

    return res.status(200).json({
        msg: result,
    });

    // Promise fetch data
    // flw.Misc.verify_Account(details)
    // .then(response => console.log(response));
});

route.post('/add-bank', UserAuthMiddleware, async (req, res) => {
    try {
        const user = await UserModel.findById(req.user);

        const { bankCode, accountNumber, bank, accountName } = req.body;

        const updateInfo = await UserModel.findByIdAndUpdate(user._id, {
            bankInfo: {
                bank,
                bankCode,
                accountName,
                accountNumber,
            },
        });

        updateInfo.save();

        return res.status(200).json({
            msg: 'Bank added succesfully',
        });
    } catch (error) {
        console.log(error);

        return res.status(500).json({
            msg: 'Something went wrong. Try Again!'
        });
    }
});

route.post('/verify-payment', UserAuthMiddleware, async (req, res) => {
    try {
        const user = await UserModel.findById(req.user);

        const tranx_id = req.headers['tranx-id'];

        
        const options = {
            method: 'GET',
            url: `https://api.flutterwave.com/v3/transactions/${tranx_id}/verify`,
            headers: {
            'Content-Type': 'application/json',
            Authorization: process.env.FLW_SECRET_KEY,
            },
        };
    
        const response = await axios(options);

        if (response.status !== 200) {
            return res.status(404).json({
            status: 'failed',
            message: 'Payment Failed!!',
            });
        }


        // After Successfully Verifying the Payment this will give value to the customer
        const balance = await UserModel.findByIdAndUpdate(user._id, {
            accountBalance: response.data.data.amount,
        });
    
        balance.save();
    
        return res.status(200).json({
            status: 'success',
            message: 'Payment Successful',
        });
    } catch (error) {
        console.log(error.data);
      return res.status(400).json({
        status: 'failed',
        message: 'Bad Request',
      });
    }
});



module.exports = route;