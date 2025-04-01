const router = require('express').Router()
const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken'); 
const axios = require('axios'); 
let connectDB = require('./../database.js')
require('dotenv').config();


let db
connectDB.then((client)=>{
  db = client.db('triangle')
  console.log('group DB연결성공')
}).catch((err)=>{
  console.log(err)
}) 

// 그룹 개설 API
router.post('/create', async (req, res) => {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(401).json({ message: '인증 토큰이 제공되지 않았습니다.' });
    }

    try {
        
        const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
        const userId = decoded.userId; 
  
        
        const { title, note, foodCategory, maxPeople, together, sameGender, hashtags, location } = req.body;
  
        
        if (!title || !foodCategory || !maxPeople || together === undefined || sameGender === undefined || !location) {
            return res.status(400).json({ message: '모든 필드를 입력해 주세요.' });
        }

        const finalNote = note || "상세 설명이 존재하지 않습니다";
        const finalHashtags = hashtags || [];

        // 첫 번째 멤버는 방 생성자
        const members = [userId]; 
        // 방 상태는 초기에 개설자 한명뿐이니까 true로 둠
        const status = true;
        
        
        const newGroup = {
            title,
            note: finalNote,  
            foodCategory,
            maxPeople,
            together,
            sameGender,
            hashtags: finalHashtags,  
            members,  
            location,
            status, // 방 현재 상태 => maxPeople 수가 되면 false로 변경해서 더이상 못들어오게함
            creator: new ObjectId(userId), // 그룹 생성자의 userId 저장
            createdAt: new Date(),
        };

        
        const result = await db.collection('groups').insertOne(newGroup);

        
        return res.status(201).json({
            message: '그룹이 성공적으로 생성되었습니다.',
            groupId: result.insertedId,
        });
    } catch (error) {
        console.error('그룹 개설 오류:', error);
        res.status(500).json({ message: '서버 오류 발생' });
    }
});


module.exports = router 