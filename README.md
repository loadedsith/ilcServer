ILC Server:

You will need:
   a ilcServer/fbAppSecret file, its a one line text file used to configure the current facebook app secret.
   a ilcServer/firebaseUrl file, its a one line text file used to configure the current firebase url.

Run the server, with watch, with `gulp` or without watch with `node index.js`

Debugging: Gulp passes `--debug` to index.js, or you could do so manually: `node --debug index.js`. Then just connect to http://127.0.0.1:8080/debug?port=5858 (if that doesnt work, run node-inspector in a separate session, this will run the inspector server if it didnt start automatically)

A room name is defined as the lower userId + the larger. See `makeRoomPairName()` in index.js for an implementation.
