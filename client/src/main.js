const mediasoup = require('mediasoup-client');
const { v4:uuid } = require('uuid');

let btnSub;
let btnCam;
let btnScreen;
let textPublish;
let textWebcam;
let textScreen;
let textSubscribe;
let localVideo;
let remoteVideo;
let device;
let producer;
let consumeTransport;
let userId;
let isWebcam;
let produceCallback, produceErrback;
let consumerCallback, ConsumerErrback;
const websocketURL = 'wss://192.168.1.152:8000/ws'

let socket;

document.addEventListener("DOMContentLoaded",function() {
    btnCam = document.getElementById("btn_webcam");
    btnScreen = document.getElementById("btn_screen");
    btnSub = document.getElementById("btn_subscribe");
    textWebcam = document.getElementById("webcam_status");
    textScreen = document.getElementById("screen_status");
    textSubscribe = document.getElementById("subscribe_status");
    localVideo = document.getElementById("localVideo");
    remoteVideo = document.getElementById("remoteVideo");

    //button event listeners
    btnCam.addEventListener('click', publish);
    btnScreen.addEventListener('click', publish);
    btnSub.addEventListener('click', subscribe);
});

const connect = () => {
    socket = new WebSocket(websocketURL);
    socket.onopen = () => {
        // start out socket request
        const msg = {
            "type": "getRouterRtpCapabilities"
        }
        const resp = JSON.stringify(msg);
        socket.send(resp);
        socket.onmessage = (event) => {
            const jsonValidation = IsJsonString(event.data);
            if(!jsonValidation){
                console.error("json error");
                return;
            }
            let resp = JSON.parse(event.data);
            console.log('resp type: => ',resp.type);
            switch (resp.type){
                case 'routerCapabilities':
                    onRouterCapabilities(resp);
                break;
                case 'producerTransportCreated':
                    onProducerTransportCreated(resp);
                break;
                case 'subTransportCreated':
                    onSubTransportCreated(resp);
                break;
                case 'resumed':
                    console.log('-------------------------');
                    console.log(event.data);
                    console.log('--------------------------');
                break;
                case "subscribed":
                    onSubscribed(resp);
                break;
            }
        }
    }
}

connect();

const onSubscribed = async (event) =>{
    const {
        producerId,
        id,
        kind,
        rtpParameters
    } = event.data;
    let codecOptions = {};
    const consumer = await consumeTransport.consume({
        id,
        producerId,
        kind,
        rtpParameters,
        codecOptions,
    });
    const stream = new MediaStream();
    stream.addTrack(consumer.track);
    remoteStream = stream;
    remoteVideo.srcObject = remoteStream;
    const msg = {
        type: 'resume'
    };
    const message = JSON.stringify(msg);
    socket.send(message);

}
const onSubTransportCreated = async (event) => {
    if(event.error){
        console.error("on subtransport create error: ",event.error)
    }
    const transport = device.createRecvTransport(event.data);
    transport.on('connect',({dtlsParameters},callback, errback) => {
        const msg = {
            type: "connectConsumerTransport",
            transportId: transport.id,
            dtlsParameters
        }
        const message = JSON.stringify(msg);
        socket.send(message);
        socket.addEventListener('message',(event) => {
            const jsonValidation = IsJsonString(event.data);
            if(!jsonValidation){
                console.error("json error");
                return
            }
            let resp = JSON.parse(event.data);
            console.log('================');
            console.log(resp);
            if(resp.type === 'subConnected'){
                console.log('consumer transport connected!!!',resp);
                callback();
            }
        })
    });
    /**
     * state : connectionState
     *  closed
     * failed
     * disconnected
     * new
     * connecting
     * connected
     */
    transport.on('connectionstatechange', (state) => {
        console.log('connectionStatechange : ==> ',state);
        switch (state) {
            case 'connecting':
                textSubscribe.innerHTML = 'subscribing.....';    
            break;
            case 'connected':
                remoteVideo.srcObject = remoteStream;
                // const msg = {
                //     type: 'resume'
                // };
                // const message = JSON.stringify(msg);
                // socket.send(message);
                textSubscribe.innerHTML = 'subscribed';
            break;
            case 'failed':
                transport.close();
                textSubscribe.innerHTML = 'failed';
                btnSub.disabled = false;
            break;
            default:
                break;
        }
    })
    //consume
    const stream = await consume(transport);
    consumeTransport = transport;
}

const consume = async (transport) => {
    const { rtpCapabilities } = device;
    const msg = {
        type: 'consume',
        rtpCapabilities
    }
    const message = JSON.stringify(msg);
    socket.send(message);
}

const onProducerTransportCreated = async (event) => {
    if(event.error){
        console.error('producer transport create error: ',event.error)
        return
    }
 
    const transport = device.createSendTransport(event.data);
    transport.on('connect',async({dtlsParameters}, callback, errback) => {
        console.log('on : => connect');
        const message = {
            type : 'connectProducerTransport',
            dtlsParameters
        }
        const resp = JSON.stringify(message);
        socket.send(resp);
        socket.addEventListener('message',(event) => {
            const jsonValidation = IsJsonString(event.data);
            if(!jsonValidation){
                console.error("json error");
                return
            }
            let resp = JSON.parse(event.data);
            if(resp.type === 'producerConnected'){
                console.log('got producerConnected!!!',resp);
                callback();
            }
            //producerConnected
           
        })
    })
    //begin transport on producer
    transport.on('produce',async ({kind,rtpParameters},callback, errback) => {
        console.log('on : => produce');
        const message = {
            type: 'produce',
            transportId: transport.id,
            kind,
            rtpParameters
        };
        const resp = JSON.stringify(message);
        socket.send(resp);
        socket.addEventListener('message', (event) => {
            const jsonValidation = IsJsonString(event.data);
            if(!jsonValidation){
                console.error("json error");
                return
            }
            let resp = JSON.parse(event.data);
            console.log('produce -> published : => ',resp);
            callback({id: resp.data.id});  
        })

    });
    //end transport producer
    //connection state change begin
    transport.on('connectionstatechange', (state) => {
        console.log('connectionStatechange : ==> ',state);
        switch (state) {
            case 'connecting':
                textPublish.innerHTML = 'publishing.....';    
            break;
            case 'connected':
                textPublish.innerHTML = 'published';
            break;
            case 'failed':
                transport.close();
                textPublish.innerHTML = 'failed';
            break;
            default:
                break;
        }
    })
    //connection state change end
    let stream ;
    try {
        stream = await getUserMedia(transport,isWebcam);
        localVideo.srcObject = stream;
        textPublish.innerHTML = 'published';
        const track = stream.getVideoTracks()[0];
        const params = { track };
        console.log("params: => ",params);
        producer = await transport.produce(params);
    } catch (error) {
        console.error(error);
        textPublish.innerHTML = 'failed!';
    }
}

const onRouterCapabilities = (resp) => {
    loadDevice(resp.data);
    btnCam.disabled = false;
    btnScreen.disabled = false;
}

const publish = (e) => {
    isWebcam = ( e.target.id === 'btn_webcam' );
    textPublish = isWebcam ? textWebcam : textScreen;
    btnScreen.disabled = true;
    btnCam.disabled = true;

    const message = {
        type: 'createProducerTransport',
        forceTcp: false,
        rtpCapabilities : device.rtpCapabilities
    }

    const resp = JSON.stringify(message);
    socket.send(resp);
}

const subscribe = (e) => {
    btnSub.disabled = true;
    const msg = {
        type: "createConsumerTransport",
        forceTcp: false,
    }
    const message = JSON.stringify(msg);
    socket.send(message);
}

const IsJsonString = (str) => {
    try{
        JSON.parse(str);
    }catch(error){
        return false;
    }
    return true;
}

const loadDevice = async (routerRtpCapabilities) => {
    try{
        device = new mediasoup.Device();
    } catch (error) {
        if(error.name === 'UnsupportedError'){
            console.log('browser not supported!');
        }
    }

    await device.load({routerRtpCapabilities});
}

const getUserMedia = async(trasnport,isWebcam) => {
    if(!device.canProduce('video')){
        console.error('cannot produce video')
        return;
    }
    let stream;
    try {
        stream = isWebcam ? 
        await navigator.mediaDevices.getUserMedia({video:true,audio:true}) : 
        await navigator.mediaDevices.getDisplayMedia({video:true});
    } catch (error) {
        console.error(error);
        throw error;
    }
    return stream;

}