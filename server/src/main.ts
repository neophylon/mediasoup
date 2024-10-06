import fs from 'fs';
import express from 'express';
import *as http from 'http';
import *as https from 'https';
import * as Websocket from 'ws';
import { WebsocketConnection } from './lib/ws';

const main = async () => {
    const app = express();

    const options = {
        key: fs.readFileSync('./server/ssl/key.pem', 'utf-8'),
        cert: fs.readFileSync('./server/ssl/cert.pem', 'utf-8')
    }

    // const server = http.createServer(app);
    const server = https.createServer(options,app)
    const websocket = new Websocket.Server({server, path:'/ws'});

    WebsocketConnection(websocket);

    const port = 8000;

    server.listen(port, () => {
        console.log('Server started on port 8000');
    })


}

export { main }