var express = require("express");
var app = express();
var port = 3000;
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(bodyParser.json());

var jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var auth = require('socket.io-client');
var fs = require("fs");
var path = require('path');
var ejsLayouts = require("express-ejs-layouts");
app.set('view engine', 'ejs'); //ejs is nice to dynamically create the page, for example for things clients should never see(functions for employees only)

//------------------------------------------ imports done

var secretVar = "secretVar";


////////////////data and data manipulation

var users = []; //auth data


var clients = []; //connected clients
var waitingClients = []; //clients waiting for a free support guy/gal/thing from beyond the stars etc.


//we assume the login name is unique, otherwise we would require an extra layer(a mapping) to differentiate the names, like an ID 
//so currently, user name == ID
function addNewClient(connection, usrName) {
	clients.push({
		socket: connection,
		login: usrName,
		msgs: []
	});
	waitingClients.unshift(usrName); //get new client to the start of the line
	getNewClient();
}

//the list of currently connected employees
var employees = [];


function addNewEmployee(connection, usrName) {
	employees.push({
		socket: connection,
		login: usrName,
		client: -1
	});
}


//is the client waiting for support?
function isWaiting(id) {
	var i;
	for (i = 0; i < waitingClients.length; i++) {
		if (waitingClients[i] === id) {
			return true;
		}
	}
	return false;
}


function emitToEmployee(clientID, msg) {
	//console.log(employees);
	var i = 0;
	var found = false;
	while (i < employees.length && !found) {
		if (employees[i].client === clientID) {
			console.log("found the support");
			employees[i].socket.emit("msg", msg);
			found = true;
		}
		i = i + 1;
	}
	//if support is unavailable store messages
	if (!found) {
		var j = 0;
		var found = false;
		while (j < clients.length && !found) {
			if (clients[j].login === clientID) {
				clients[j].msgs.push(msg);
				found = true;
			}
			j = i + 1;
		}
	}
}


function emitToClient(senderID, msg) {
	console.log("sending to client");
	var clientID = "";
	//search for client	
	for (j = 0; j < employees.length; j++) {
		console.log("------------------------");
		console.log("employee: " + employees[j].login);
		console.log(senderID);
		if (employees[j].login === senderID) {
			console.log("found the client");
			clientID = employees[j].client;
		}
	}
	//find and send to client
	var i = 0;
	var found = false;
	while (i < clients.length && !found) {
		if (clients[i].login === clientID) {
			clients[i].socket.emit("msg", msg);
			found = true;
		}
		i = i + 1;
	}
}

//get a new client for an employee
function getNewClient() {
	if (waitingClients.length != 0) {
		var found = false;
		var i = 0;
		while (!found && i < employees.length) {
			if (employees[i].client === -1 && waitingClients.length > 0) {
				found = true;
				employees[i].client = waitingClients.pop();
				emitToEmployee(employees[i].client, "Got new client!");

				//find the new client and send stored messages
				for (j = 0; j < clients.length; j++) {
					if (clients[j].login === employees[i].client) {
						while (clients[j].msgs.length > 0) {
							emitToEmployee(employees[i].client, clients[j].msgs.shift());
						}
					}
				}
				emitToClient(employees[i].login, "A support employee is available to help you.");
			}
			i = i + 1;
		}
	}
}

////Getting data from selected authentification server

var socket = auth.connect('http://localhost:3001', {
	reconnect: true
});

// Add a connect listener
socket.on('connect', function(socket) {
	console.log('Connected!');
});

//get new user from auth srv
socket.on('addUser', function(user) {
	var exists = false;
	for (i = 0; i < users.length; i++) {
		if (users[i].usr === user.usr && users[i].token === user.token) {
			exists = true;
		}
	}
	if (!exists) {
		console.log("Adding new user");
		users.push(user);
		exists = false;
	}
	console.log(users);
});

/////server connections

//chat
io.on('connection', function(client) {
	console.log('Client connected...');

	//get data from socket about user and add to current ones
	client.on('join', function(userData) {
		console.log(userData);
		if (userData.support === true) {
			addNewEmployee(client, userData.usr);
		} else {
			addNewClient(client, userData.usr);
		}
	});

	//standart message
	client.on('msg', function(msgContent) {
		console.log(msgContent);
		client.emit("msg", msgContent.usr + ": " + msgContent.msg); //emit to self to confirm

		//lazy method, properly it would have to be to search users and get the support option from there, rather than send it in the request
		if (msgContent.support === 'true') {
			emitToClient(msgContent.usr, msgContent.usr + ": " + msgContent.msg);

		} else {
			emitToEmployee(msgContent.usr, msgContent.usr + ": " + msgContent.msg);
		}
	});

	//remove on disconnect
	client.on('disconnect', function() {
		console.log("Handle disconnection");
		//search if it was an employee
		var i = 0;
		var index = -1;
		while (i < employees.length && index === -1) {
			if (client.id === employees[i].socket.id) {
				index = i;
			}
			i++;
		}
		if (index != -1) {
			employees.splice(index, 1);
		} else {
			//see if it was a client
			i = 0;
			while (i < clients.length && index === -1) {
				if (client.id === clients[i].socket.id) {
					index = i;
				}
				i++;
			}
			if (index != -1) {
				clients.splice(index, 1);
			}

		}
	});

	//employee is finished with current user
	client.on('nextUser', function(msgContent) {
		if (msgContent.support === true) {
			for (i = 0; i < employees.length; i++) {
				if (msgContent.usr === employees[i].login) {
					employees[i].client = -1;
					getNewClient();
				}
			}
		}
	});
	
	
});


//authentification and send webpage
app.get("/:usr/:token", function(req, res) {


	// decode token
	var token = req.params.token;
	//console.log("The token is :"+ req.params.token);
	var usr = req.params.usr;
	//console.log(usr);
	if (token) {

		// verifies secret and checks exp
		jwt.verify(token, secretVar, function(err, decoded) {
			if (err) {

				console.log("WAT");
				return res.json({
					success: false,
					message: 'Failed to authenticate token.'
				});
				//console.log(err);
				//console.log(token);
				//res.send("Failed to autentificate token");
			} else {
				// if everything is good, save to request for use in other routes
				req.decoded = decoded;
				//send webpage	
				var sup = false; //is support
				var l = 0;
				while (sup === false && l < users.length) {
					if (users[l].usr === usr) {
						sup = users[l].support;
					}
					l = l + 1;
				}
				res.render(__dirname + '/ejs/index', {
					support: sup,
					user: usr
				});
			}
		});

	} else {

		// if there is no token
		// return an error
		return res.status(403).send({
			success: false,
			message: 'No token provided.'
		});

	}

});


server.listen(port);
console.log("Listening on port " + port);