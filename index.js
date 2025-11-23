const express = require('express')
const cors = require('cors');
const app = express()
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wbmojlp.mongodb.net/?appName=Cluster0`;
const port = process.env.PORT || 3000
// middle Ware  
app.use(cors())
app.use(express.json())



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

  //parcel api  
   app.get('/parcels',async(req,res)=>{
       const query = {}
       const email = req.query.email
       if(email){
        query.senderEmail = email
       }
       const cursor = parcelCollection.find(query)
       const result  = await cursor.toArray()
       res.send(result)
   })



  app.post('/parcels',async(req,res)=>{
       const parcel = req.body
       const result = await parcelCollection.insertOne(parcel)
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
