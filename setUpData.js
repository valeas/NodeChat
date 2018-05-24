var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/";

MongoClient.connect(url, function(err, db) {
  if (err) throw err;
  var dbo = db.db("mydb");
  var myobj = [
    { name: 'test1', password: '1', support: false},
    { name: 'test2', password: '2', support: false},
    { name: 'test3', password: '3', support: false},
    { name: 'test4', password: '4', support: false},
    { name: 'sup1', password: '1', support: true},
    { name: 'sup2', password: '2', support: true}
  ];
  dbo.collection("customers").insertMany(myobj, function(err, res) {
    if (err) throw err;
    console.log("Number of documents inserted: " + res.insertedCount);
    db.close();
  });
}); 
