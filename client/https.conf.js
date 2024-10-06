var fs = require("fs");

module.exports = {
	cert: fs.readFileSync(__dirname + "/server/ssl/cert.pem"),
	key: fs.readFileSync(__dirname + "/server/ssl/key.pem"),
	// passphrase: "12345"
};