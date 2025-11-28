const express = require('express')
const cors = require('cors');
const app = express()
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wbmojlp.mongodb.net/?appName=Cluster0`;

const port = process.env.PORT || 3000
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
// const stripe = require('stripe')(process.env.STRIPE_SECRETE);

const stripe = require('stripe')(process.env.STRIPE_SECRETE);


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
    const parcelCollection = db.collection("parcels");
    const paymentCollection = db.collection("payments")

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
    app.get('/payments',async(req,res)=>{
       const email = req.query.email
       const query = {};
       if(email){
        query.customerEmail = email
       }
       const cursor = paymentCollection.find(query)
       const result = await cursor.toArray()
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
