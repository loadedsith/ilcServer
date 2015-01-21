ILC Server:

Very simple server that 1) Validates a users's token. 2) Subscribes to the facebook id's token rooms in firebase.

You will need:
   a ilcServer/fbAppSecret file, its a one line text file used to configure the current facebook app secret.
   a ilcServer/firebaseUrl file, its a one line text file used to configure the current firebase url.

Run the server, with watch, with `gulp` or without watch with `node index.js`

Debugging: Gulp passes `--debug` to index.js, or you could do so manually: `node --debug index.js`. Then just connect to http://127.0.0.1:8080/debug?port=5858

All chats should be named '[userid1] + [userid2]' where [userid1] < [userid2], to ensure they can be looked up easily and quickly.

TODO: Switch from auto-opening rooms on request to validating that the other user has your user id in their rooms list first.