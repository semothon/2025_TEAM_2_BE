const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const axios = require('axios'); 
const bcrypt = require('bcrypt');
require('dotenv').config();


const app = express()
const server = http.createServer(app);
const port = process.env.PORT
global.io = socketIo(server); 

let connectDB = require('./database.js')
let db
connectDB.then((client)=>{
  db = client.db('triangle')
  console.log('server DB연결성공')

}).catch((err)=>{
  console.log(err)
})

app.use(express.json());
app.use(bodyParser.json());
app.use('/auth',require('./routes/auth.js'))
app.use('/user',require('./routes/user.js'))
app.use('/group',require('./routes/group.js'))
app.use('/chat', require('./routes/chat.js'));

server.listen(port, () => {
  console.log('서버연결성공')
})

app.get('/',(req,res)=>{
  res.send("서버 잘 돌아가는중")
})