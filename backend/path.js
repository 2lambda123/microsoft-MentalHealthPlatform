var express = require('express');
var app = express();
var bodyParser = require('body-parser');

var mongoClient = require('mongodb').MongoClient;
var mongoUrl = "mongodb://localhost:27017/";
var dbName = 'mentalhealthdb';


// Collections
var usersColl = "Users";
var topicsColl = "Topics";
var chatsColl = "Chats";
var msgColl = "Message";

app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(bodyParser.json());

app.use(function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	next();
});

app.set('port', process.env.PORT || 3000);


app.post('/signup', function(postReq, postRes){
	var obj = postReq.body;
	var username = obj.username;

	mongoClient.connect(mongoUrl, obj, function(connerErr, db) {
		if (connerErr) throw connerErr;
		var dbo = db.db(dbName);

		// Verify if user already exists
		dbo.collection(usersColl).find({username : username}).toArray(function(findErr, findRes) {
			if (findErr) throw findErr;
			if (findRes.length != 0) {
				console.log("username already exists: ", username)
				db.close();
				postRes.json({statusMessage : -1});
				return;
			}

			// Insert user into db
			dbo.collection(usersColl).insertOne(obj, function(insertErr, insertRes) {
				if (insertErr) throw insertErr;
				console.log("user created: ", username);
				db.close();
				postRes.json({statusMessage : 1});
			});
		});
	});
});


app.post('/login', function(postReq, postRes) {
	var obj = postReq.body;

	mongoClient.connect(mongoUrl, obj, function(connerErr, db) {
		if (connerErr) throw connerErr;
		var dbo = db.db(dbName);

		// Verify if entry exists in users collection
		dbo.collection(usersColl).find(obj).toArray(function(findErr, findRes) {
			if (findErr) throw findErr;
			if (findRes.length != 0) {
				db.close();
				postRes.json({statusMessage : 1});
				return;
			}

			postRes.json({statusMessage : -1});
		});
	});
});


app.get('/gettopics', function(postReq, postRes) {
	console.log("Retrieving topics");
	var obj = postReq.body;

	mongoClient.connect(mongoUrl, obj, function(connerErr, db) {
		if (connerErr) throw connerErr;
		var dbo = db.db(dbName);

		dbo.collection(topicsColl).find().toArray(function(findErr, findRes) {
			if (findErr) throw findErr;
			db.close();
			postRes.json(findRes);
		});
	});
});


app.get('/getchatpreviews', function(postReq, postRes) {
	var obj = postReq.query;

	mongoClient.connect(mongoUrl, function(err, db) {
		if (err) throw err;
		var dbo = db.db("mentalhealthdb");
		dbo.collection(chatsColl).aggregate(
			[
			{ $lookup:
				  {
					from: 'Users',
					localField: 'username',
					foreignField: 'username',
					as: 'userdetail'
				  }
			},
			{ $unwind:
				{
					path: "$userdetail",
					preserveNullAndEmptyArrays: false
				}
			},
			{ $match:
				{
					TopicID : obj.topicId
				}
			}
			]
		).toArray(function(chatErr, chatRes) {
			if (chatErr) throw chatErr;

			if (chatRes.length <= 0) {
				postRes.json([]);
				return;
			}

			var chatPreviewsObj = [];
			for (var i = 0; i < chatRes.length; i ++) {
				var chatPreviewObj = {};
				chatPreviewObj.avatarId = chatRes[i].userdetail.avatarID;
				chatPreviewObj.chatId = chatRes[i].chatID
				chatPreviewObj.chatTitle = chatRes[i].chatTitle
				chatPreviewObj.chatDescription = chatRes[i].desc
				chatPreviewObj.authorName = chatRes[i].username
				chatPreviewObj.numberOfViews = chatRes[i].numberofviews
				chatPreviewObj.postedDate = chatRes[i].PostedDate
				chatPreviewsObj.push(chatPreviewObj)
			}

			postRes.json(chatPreviewsObj);
			db.close();
		});
	});
});


app.get('/getchat', function(postReq, postRes){
	var obj = postReq.query;

	mongoClient.connect(mongoUrl, function(err, db) {
		if (err) throw err;
		var dbo = db.db(dbName);
		dbo.collection(msgColl).aggregate(
			[
			{ $lookup:
				  {
					from: 'Users',
					localField: 'username',
					foreignField: 'username',
					as: 'userdetail'
				  }
			},
			{ $unwind:
				{
					path: "$userdetail",
					preserveNullAndEmptyArrays: false
				}
			},
			{ $lookup:
				{
				  from: 'Chats',
				  localField: 'chatID',
				  foreignField: 'chatID',
				  as: 'chatdetail'
				}
		  },
		  { $unwind:
			  {
				  path: "$chatdetail",
				  preserveNullAndEmptyArrays: false
			  }
		  },
			{ $match:
				{
					chatID : obj.chatId
				}
			}
			]
		).toArray(function(chatErr, chatRes) {
			if (chatErr) throw chatErr;

			if (chatRes.length <= 0) {
				postRes.json([]);
				return;
			}

			var chatObj = {};
			// Get chat data
			chatObj.chatTitle = chatRes[0].chatdetail.chatTitle;
			chatObj.numberOfReplies = chatRes.length;
			chatObj.numberOfViews = chatRes[0].chatdetail.numberofviews;
			chatObj.messages = [];

			// Create messages
			for (var i = 0; i < chatRes.length; i++) {
				var msgObj = {};
				msgObj.avatarId = chatRes[i].userdetail.avatarID;
				msgObj.authorName = chatRes[i].userdetail.username;
				msgObj.date = chatRes[i].date;
				msgObj.messageBody = chatRes[i].messageBody;

				chatObj.messages.push(msgObj);
			}

			postRes.json(chatObj);
			db.close();
		});
	});
});


app.post('/sendmessage', function(postReq, postRes){
	var obj = postReq.body;

	mongoClient.connect(mongoUrl, obj, function(connerErr, db) {
		if (connerErr) throw connerErr;
		var dbo = db.db(dbName);

		var msgObj = {};
		msgObj.chatID = obj.chatId;
		msgObj.messageBody = obj.messageBody;
		msgObj.username = obj.username;
		msgObj.date = new Date().toString();

		// Insert message into db
		dbo.collection(msgColl).insertOne(msgObj, function(insertErr, insertRes) {
			if (insertErr) throw insertErr;
			db.close();
			postRes.json({statusMessage : 1});
		});
	});
});


app.post('/createchat', function(postReq, postRes){
	var obj = postReq.query;

	mongoClient.connect(mongoUrl, obj, function(connerErr, db) {
		if (connerErr) throw connerErr;
		var dbo = db.db(dbName);

		// Create new chat
		var chatObj = {};
		chatObj.chatTitle = obj.chatTitle;
		chatObj.username = obj.username;
		chatObj.TopicID = obj.topicId;

		// Create new message
		var msgObj = {};
		msgObj.messageBody = obj.chatDescription;
		msgObj.username = obj.username;
		msgObj.date = new Date().toString();

		// Insert chat to db
		dbo.collection(chatsColl).insertOne(chatObj, function(insertChatErr, insertChatRes) {
			if (insertChatErr) throw insertChatErr;
			msgObj.chatID = insertChatRes.insertedId;

			// Insert message to db
			dbo.collection(msgColl).insertOne(msgObj, function(insertMsgErr, insertMsgRes) {
				db.close();
				postRes.json({statusMessage : 1});
			});
		});
	});
});


app.listen(app.get('port'), function(){
    console.log('Listening...');
})