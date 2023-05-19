const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

(async function () {
    try {
      mongoose.connect(process.env.dbConnection);
    } catch (error) {
      console.log(chalk.red('The Database did not Connect!!!'));
    }
  
    console.log('Connecting...');
  
    mongoose.connection.once('open', () => {
      console.log('Connection Succesfully Established Connection');
    });
}());

const corsOption = {
    origin: ['https://goldenrechargeinvestment.com/'],
};

const app = express();
const userRoutes = require('./Routes/userRoute');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: "*",
}));


app.use('/api/user/', userRoutes);


app.get('/', (req, res) => {
  res.send('The App is Working');
});

const port = process.env.PORT || 5000;

app.listen(port, () => {
    console.log(`Server started at ${port}`);
});

