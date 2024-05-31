const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser=require('cookie-parser');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// middleware 
app.use(cors({
  origin:['http://localhost:5173','http://localhost:5174'],
  credentials:true
}))
app.use(express.json());
app.use(cookieParser());

// middlewares making by user
const logger = async(req,res,next)=>{
  console.log('called:', req.host, req.originalUrl);
  next()
}
const verifyToken = async(req,res,next)=>{
  const token = req.cookies?.token;
  console.log('value of token in middleware ',token);
 if(!token){
  return res.status(401).send({message:'not authorized'})
 }
 jwt.verify(token,process.env.ACCESS_TOKEN_SECRET, (err,decoded)=>{
  // error
if(err){
  console.log(err);
  return res.status(401).send({message:'not authorized'})
}
  // if token is valid then it would be decoded
  console.log('value in the token ',decoded);
  req.user=decoded;
  next()
 })
  
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wzcn8fz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
console.log(uri);
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection

    const queryCollection = client.db('queryDB').collection('query');
    const recommendationCollection = client.db('queryDB').collection('recommendations');
    const reviewCollection = client.db('queryDB').collection('review');
//  auth related api
app.post('/jwt',logger, async(req,res) =>{
  const user = req.body;
  console.log('user for token', user);
  const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
  res
        .cookie('token', token, {
          httpOnly: true,
          secure: false,
          // sameSite:'none'
          
        })
        .send({ success: true });


})


      // service related api
    app.get('/Queries',logger, async (req, res) => {

      const result = await queryCollection.find({}).toArray();
      res.send(result);
    })
    app.post('/Queries', async (req, res) => {
      const newQuery = req.body;
      console.log(newQuery);
      const result = await queryCollection.insertOne(newQuery);
      res.send(result);
    })

    app.get('/Queries/user/:email',logger, async (req, res) => {
      const email = req.params.email;
      console.log('tok tok token', req.cookies.token);
     
      const query = { email: email }
     
      const result = await queryCollection.find(query).toArray();
      res.send(result);
    })

    app.get('/Queries/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await queryCollection.findOne(query);
      res.send(result);
    })

    //  Delete
    app.delete('/delete/:id', async (req, res) => {

      const result = await queryCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send(result)

    })

    //  U ->here concept use for finding a documents
    app.get('/singleQuery/:id', async (req, res) => {

      const result = await queryCollection.findOne({ _id: new ObjectId(req.params.id) });
      console.log(result);
      res.send(result);
    })

    app.put('/updatedQuery/:id', async (req, res) => {

      const filter = { _id: new ObjectId(req.params.id) }
      const options = { upsert: true };
      const updatedQueryField = req.body;
      const queryDetail = {
        $set: {
          product_name: updatedQueryField.product_name,
          product_brand: updatedQueryField.product_brand,
          query_title: updatedQueryField.query_title,
          boycotting_reason: updatedQueryField.boycotting_reason,
          image: updatedQueryField.image,


        }
      }

      const result = await queryCollection.updateOne(filter, queryDetail, options);
      console.log(result);
      res.send(result);



    })

    app.get('/api/recent-queries', async (req, res) => {
      try {
        const recentQueries = await queryCollection.find()
          .sort({ currentDate: -1 })
          .limit(8)
          .toArray();
        res.send(recentQueries);
      } catch (err) {
        res.status(500).send(err);
      }
    });

    app.post('/addRecommendation', async (req, res) => {
      const recommendation = req.body;
      const { queryId } = recommendation;

      try {
        
        const result = await recommendationCollection.insertOne(recommendation);

       
        const updateResult = await queryCollection.updateOne(
          { _id: new ObjectId(queryId) },
          { $inc: { recommendationCount: 1 } }
        );

        res.send({ result, updateResult });
      } catch (err) {
        res.status(500).send(err);
      }
    });

    app.get('/addRecommendation', async (req, res) => {

      const result = await recommendationCollection.find({}).toArray();
      res.send(result);
    })

    app.get('/recommendations/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const recommendations = await recommendationCollection.find({ queryId: id}).toArray();
        res.send(recommendations);
      } catch (err) {
        res.status(500).send(err);
      }
    });


     
     app.get('/recommendations/user/:email', async (req, res) => {
      try {
        const email = req.params.email;
        const recommendations = await recommendationCollection.find({ recommenderEmail: email }).toArray();
        res.send(recommendations);
      } catch (err) {
        res.status(500).send(err);
      }
    });

    app.get('/recommendationForMe/:email', async (req, res) => {
      try {
        const email = req.params.email;
        const recommendations = await recommendationCollection.find({ userEmail: email }).toArray();
        res.send(recommendations);
      } catch (err) {
        res.status(500).send(err);
      }
    });
    
    app.delete('/recommendation/delete/:id', async (req, res) => {
      try {
        const recommendationId = req.params.id;

        
        const recommendation = await recommendationCollection.findOne({ _id: new ObjectId(recommendationId) });

        if (!recommendation) {
          return res.status(404).send({ message: "Recommendation not found" });
        }

        const queryId = recommendation.queryId;

  
        const deleteResult = await recommendationCollection.deleteOne({ _id: new ObjectId(recommendationId) });

        if (deleteResult.deletedCount > 0) {
         
          const updateResult = await queryCollection.updateOne(
            { _id: new ObjectId(queryId) },
            { $inc: { recommendationCount: -1 } }
          );

          res.send({ deleteResult, updateResult });
        } else {
          res.status(500).send({ message: "Failed to delete recommendation" });
        }
      } catch (err) {
        res.status(500).send(err);
      }
    });
    
    app.get('/reviews', async (req, res) => {

      const result = await reviewCollection.find({}).toArray();
      res.send(result);
    })


    



    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Alternative product information system server is running')
})

app.listen(port, () => {
  console.log(`Alternative product information system server is running on port ${port}`);
})