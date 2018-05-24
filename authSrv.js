var express = require("express");
var app = express();
var mongo = require('mongodb');
var port = 3001;
var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/";
var bodyParser = require('body-parser');
var fs = require("fs");
var path = require('path');
var ejsLayouts = require("express-ejs-layouts");
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(bodyParser.json());

var secretVar = "secretVar";
var jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
var server = require('http').createServer(app);
var io = require('socket.io')(server);


io.on('connection', function(client) {
	console.log('Client connected...');

	client.on('join', function(data) {
		console.log(data);
	});
});


app.get("/", function(req, res) {
	res.render(__dirname + '/ejs/login', {});
});

app.post("/validate", function(req, res) {
	MongoClient.connect(url, function(err, db) {
		if (err) throw err;
		var dbo = db.db("mydb");
		var query = {
			name: req.body.username,
			password: req.body.password
		};
		dbo.collection("customers").findOne(query, function(err, result) {
			if (err) throw err;
			console.log(result);
			if (result === null) {
				res.send("NOPE");
				valid = false;
			} else {
				// if user is found 
				// create a token					
				var token = jwt.sign({
					data: 'foobar' + req.body.username
				}, secretVar, {
					expiresIn: '1h'
				});

				io.emit("addUser", {
					usr: req.body.username,
					userToken: token,
					support: result.support
				}); //send login to all available chat servers

				res.writeHead(301, {
					Location: 'http://localhost:3000/' + req.body.username + "/" + token
				});
				res.end();

			}
			db.close();
		});
	});
});

server.listen(port);
console.log("Listening on port " + port);