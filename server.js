const express = require('express')
const axios = require('axios'); 
const jwt = require('jsonwebtoken'); 
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express()
const port = process.env.PORT

let connectDB = require('./database.js')
let db
connectDB.then((client)=>{
  db = client.db('triangle')

  app.listen(port, () => {
    console.log('서버연결성공')
})

}).catch((err)=>{
  console.log(err)
})

app.use(express.json());

app.use('/auth',require('./routes/auth.js'))
app.use('/user',require('./routes/user.js'))