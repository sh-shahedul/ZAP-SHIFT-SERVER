const express = require('express')
const cors = require('cors');
const app = express()
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wbmojlp.mongodb.net/?appName=Cluster0`;

const port = process.env.PORT || 3000

const admin = require("firebase-admin");

const serviceAccount = require("./firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});



const crypto = require("crypto");
function generateTrackingId() {
  const prefix = "PRCL"; // your brand prefix
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const random = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6-char random hex

  return `${prefix}-${date}-${random}`;
}

console.log(generateTrackingId());
// middle Ware  
app.use(cors())
app.use(express.json())

 const verifyFirebaseToken = async (req,res,next)=>{
    console.log("in the verified headers", req.headers.authorization) 
      if(!req.headers.authorization){
        return res.status(401).send({message:'Unauthorized Access'})
      }
      const token = req.headers.authorization.split(" ")[1]
      if(!token){
         return res.status(401).send({message:'Unauthorized Access'})
      }
      try{
      const decoded = await admin.auth().verifyIdToken(token)
      console.log('after decoded in the token',decoded)
      req.decoded_email = decoded.email
      next() 
      }
      catch(eror){
         return res.status(401).send({message:'Unauthorized Access'})
      }

  
 }
// const stripe = require('stripe')(process.env.STRIPE_SECRETE);

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


const client = new MongoClient(uri, {
    serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
  
    await client.connect();

    const db = client.db("zap_shift_db");
    const userCollection = db.collection("users")
    const parcelCollection = db.collection("parcels");
    const paymentCollection = db.collection("payments")
    const riderCollection = db.collection("riders")

    //  middleware 
      const verifyAdmin =async(req,res,next)=>{
        const email = req.decoded_email
        const  query = {email}
        const user = await userCollection.findOne(query);
        if(!user ||user.role !=='admin'){
           return res.status(403).send({message:'forbidden  Access'})
        }


        next()
      }





    // user related api 
     app.get('/users',verifyFirebaseToken,async(req,res)=>{
      const serchText = req.query.serchText
      const query = {}
       if(serchText){
        // query.displayName = { $regex: serchText , $options:'i'}

        query.$or= [
          { displayName :{ $regex: serchText , $options:'i'}} ,
          { email :{ $regex: serchText , $options:'i'}} 
        ]
       }





      const cursor = userCollection.find(query).sort({createAt:-1}).limit(5)
      const result = await cursor.toArray()
      res.send(result)
     })
     app.get('/users/:id',async(req,res)=>{
      
     })
     app.get('/users/:email/role',async(req,res)=>{
          const email = req.params.email
          const query = {email}
           const user = await userCollection.findOne(query)
           res.send({role: user?.role||'user'})
     })



    app.post('/users',async(req,res)=>{
         const user = req.body
         user.role = 'user'
         user.createAt = new Date();
         
          const email = user.email;

          // google sign  check ager user naki new user 
          const userExist = await userCollection.findOne({email})
          if(userExist){
            return res.send({message:'user exist'})
          }



         const result  = await userCollection.insertOne(user)
         res.send(result)

    })

    app.patch('/users/:id',verifyFirebaseToken,verifyAdmin,async(req,res)=>{
          const id = req.params.id
          const roleInfo  = req.body
          const query = {_id : new ObjectId(id)}
          const updateDoc = {
            $set :{
              role: roleInfo.role
            }
          }
          const result = await userCollection.updateOne(query,updateDoc) 
          res.send(result)
    })



  //parcel api  
   app.get('/parcels',async(req,res)=>{
       const query = {}
       const email = req.query.email
       if(email){
        query.senderEmail = email
       }
       const options = {sort:{createAt:-1}}
       const cursor = parcelCollection.find(query,options)
       const result  = await cursor.toArray()
       res.send(result)
   })

   app.get('/parcels/:id', async(req,res)=>{
       const id  = req.params.id;
       const query = {_id :new ObjectId(id)}
       const result =await parcelCollection.findOne(query)
      res.send(result)
   })



  app.post('/parcels',async(req,res)=>{
       const parcel = req.body;
         //parcel create   time
         parcel.createAt = new Date ();
       const result = await parcelCollection.insertOne(parcel)
       res.send(result)
  })

  app.delete('/parcels/:id',async(req,res)=>{
     const id  = req.params.id
     const query = {_id :new ObjectId(id)}
     const result = await parcelCollection.deleteOne(query);
     res.send(result)

  })

  // old 
  app.post('/create-checkout-session', async (req, res)=>{
    const paymentInfo = req.body
    const ammount = parseInt(paymentInfo.cost)*100
    const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        
        price_data: {
          currency:'USD',
          unit_amount:ammount,
          product_data:{
            name:paymentInfo.parcelName,
          }
        },

        quantity: 1,
      },
    ],
    metadata: {
     parcelId :paymentInfo.parcelId,
     parcelName :paymentInfo.parcelName,
    },
    customer_email:paymentInfo.senderEmail,
    mode: 'payment',
      locale: 'en',
    success_url: `${process.env.SITE_DOMAIN}/dashbord/payment-success`,
    cancel_url: `${process.env.SITE_DOMAIN}/dashbord/payment-cancelled`,
  })
  console.log(session)
  res.send({url:session.url})

  })

    // new 
  app.post('/payment-checkout-session', async (req, res)=>{
    const paymentInfo = req.body
    const ammount = parseInt(paymentInfo.cost)*100
    const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        
        price_data: {
          currency:'USD',
          unit_amount:ammount,
          product_data:{
            name:paymentInfo.parcelName,
          }
        },

        quantity: 1,
      },
    ],
    metadata: {
     parcelId :paymentInfo.parcelId
    },
    customer_email:paymentInfo.senderEmail,
    locale: 'en',
    mode: 'payment',
    success_url: `${process.env.SITE_DOMAIN}/dashbord/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.SITE_DOMAIN}/dashbord/payment-cancelled`,
  })
  console.log(session)
  res.send({url:session.url})

  })

    app.patch('/payment-success',async(req,res)=>{
      const sessionId = req.query.session_id;
       const session = await stripe.checkout.sessions.retrieve(sessionId);
       
      const transitionId = session.payment_intent
      const query = {transitionId:transitionId}
      const paymentExist  = await paymentCollection.findOne(query)
      console.log(paymentExist);
       if(paymentExist){
          return  res.send({message:"already Exists",
                      transitionId, 
                      trakingId :paymentExist.trakingId
          })
       }


       console.log('session retrive',session)
       const trakingId = generateTrackingId()
       if(session.payment_status==='paid'){
        const id = session.metadata.parcelId;
        const query ={_id: new ObjectId(id)}
        const update = {
          $set :{
            paymentsStatus : "paid",
            trakingId :trakingId
          }
        }
        const result = await parcelCollection.updateOne(query,update)

          const payment ={
               currency : session.currency,
               ammount : session.amount_total,
               parcelId : session.metadata.parcelId,
               parcelName : session.metadata.parcelName,
               transitionId : session.payment_intent,
               customerEmail : session.customer_email,
               paymentStatus : session.payment_status,
               paidAt : new Date(),
               trakingId :trakingId
          }
          
          if(session.payment_status==='paid'){
          const resultPayment  = await paymentCollection.insertOne(payment)
         return  res.send({success:true,
               modifyParcel:result ,
               paymentInfo:resultPayment,
               trakingId: trakingId,
               transitionId : session.payment_intent

            })
          }

     
       }

    return res.send({success:false})
    })  

    //payment related api  
    app.get('/payments', verifyFirebaseToken,async(req,res)=>{
       const email = req.query.email
       const query = {};
       if(email){
        query.customerEmail = email
        if(email !==req.decoded_email){
          return res.status(403).send({message:'Forbidden Access'})
        }
       }
       const cursor = paymentCollection.find(query).sort({paidAt:-1})
       const result = await cursor.toArray()
       res.send(result)
    })

   //rider  related API 

    app.get('/riders',async(req,res)=>{
        const status = req.query.status
        const query = {}
          if(status){
            query.status = status
          }
        const cursor = riderCollection.find(query)
        const result = await cursor.toArray()
        res.send(result)

   })





   app.post('/riders',async(req,res)=>{
           const rider = req.body
           rider.status = 'pending'
           rider.createdAt = new Date()
           const result = await riderCollection.insertOne(rider)
           res.send(result)


   })

   app.patch('/riders/:id',verifyFirebaseToken,verifyAdmin, async(req,res)=>{
            const  id = req.params.id
            const status = req.body.status
            const  query ={_id: new ObjectId(id)}
             const updateDoc = {
              $set:{
                status:status
              }
             }
             const result = await riderCollection.updateOne(query,updateDoc)
             if(status==="Approved"){
              const email = req.body.email
              const userQuery = {email:email}
              const updateUser = {
                $set :{
                  role : 'rider'
                }
              }
              const resultUser = await userCollection.updateOne(userQuery,updateUser)
             }
             res.send(result)
   })

  app.delete('/riders/:id',async(req,res)=>{
     const id = req.params.id
     const query = {_id: new ObjectId(id)}
     const result = await riderCollection.deleteOne(query)
     res.send(result)
  })





   
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    
    // await client.close();  
  }
}
run().catch(console.dir);





app.get('/', (req, res) => {
  res.send('Zap shift server is Running ')
})

app.listen(port, () => {
  console.log(`Zap shift server is Running on port ${port}`)
})
