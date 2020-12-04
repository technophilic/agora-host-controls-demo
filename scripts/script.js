/**
 * @name handleFail
 * @param err - error thrown by any function
 * @description Helper function to handle errors
 */
let handleFail = function(err){
    console.log("Error : ", err);
};

// Queries the container in which the remote feeds belong
let remoteContainer= document.getElementById("remote-container");
let stopButton = document.getElementById("stop");
let participantContainer= document.getElementById("participants");

/**
 * @name addVideoStream
 * @param streamId
 * @description Helper function to add the video stream to "remote-container"
 */
function addVideoStream(streamId){
    let streamDiv=document.createElement("div"); // Create a new div for every stream
    streamDiv.id= String(streamId);                       // Assigning id to div
    streamDiv.style.transform="rotateY(180deg)"; // Takes care of lateral inversion (mirror image)
    remoteContainer.appendChild(streamDiv);      // Add new div to container
}

/**
 * @name removeVideoStream
 * @param evt - Remove event
 * @description Helper function to remove the video stream from "remote-container"
 */
function removeVideoStream (evt) {
    let stream = evt.stream;
    stream.stop();
    stream.close();
    removeFromStreams(stream)
    let remDiv = document.getElementById(stream.getId());
    remDiv.parentNode.removeChild(remDiv);
}


/**
 * @name addParticipantToList
 * @description add a new participant to the participant list
 * @param uid - user id of the participant. It is "0" for local user
 * @param name - Name of the participant
 */
function addParticipantToList (uid,name) {
    let participantDiv = document.createElement("li"); // Create a new div for every stream
    participantDiv.id = `participant${uid}`;                       // Assigning id to div
    participantDiv.innerHTML = `<span>${name}</span>${uid===0?'(local)':'(remote)<button id="kick-btn-'+uid+'">kick out</button>'}<button id="aud-btn-${uid}">mute audio</button><button id="vid-btn-${uid}">mute video</button>`;
    participantContainer.appendChild(participantDiv);      // Add new div to container

}


/**
 * @name removeParticipantFromList
 * @description removes a participant from the participant list
 * @param uid - user id of the participant. It is "0" for local user
 */
function removeParticipantFromList (uid) {
    let remDiv=document.getElementById(`participant${uid}`);
    console.log(uid, remDiv);
    remDiv && remDiv.parentNode.removeChild(remDiv);
}

/**
 * @name sendhostMessage
 * @description Sends a host control message to the remote user.
 * @param rtmClient - Agora RTM client
 * @param peerId - Id of a remote user (peer)
 * @param type - Type of message that needs to be sent can be unmuteAudio, muteAudio. unmuteVideo, muteVideo, kicked
 */
const sendhostMessage = (rtmClient, peerId, type) => {
    console.log("sending host message", rtmClient, peerId, type);
    rtmClient.sendMessageToPeer(
        {text: type}, // An RtmMessage object.
        peerId, // The uid of the remote user.
      ).then(sendResult => {
        if (sendResult.hasPeerReceived) {
          // Your code for handling the event when the remote user receives the message.
        } else {
          // Your code for handling the event when the message is received by the server but the remote user cannot be reached.
        }
      }).catch(error => {
        // Your code for handling the event when the message fails to be sent.
      });
};


let remoteStreams={};
let localStream;
const addToStreams = stream => remoteStreams[stream.getId()] = stream;
const removeFromStreams = stream => remoteStreams[stream.getId()] = undefined;

const isAudioMuted = ele => ele.innerHTML === 'unmute audio'; // Replace with any custom logic
const isVideoMuted = ele => ele.innerHTML === 'unmute video'; // Replace with any custom logic

const toggleAudioUI = (ele, muted) => muted ? ele.innerHTML = 'unmute audio': ele.innerHTML = 'mute audio';
const toggleVideoUI = (ele, muted) => muted ? ele.innerHTML = 'unmute video': ele.innerHTML = 'mute video';


const toggleLocalAudio = audElement => isAudioMuted(audElement) ? localStream.unmuteAudio() : localStream.muteAudio();
const toggleLocalVideo = vidElement => isVideoMuted(vidElement) ? localStream.unmuteVideo() : localStream.muteVideo();

const assignLocalClickHandlers = (audElement, vidElement) => {
    audElement.onclick = () => {
        toggleLocalAudio(audElement);
        toggleAudioUI(audElement, !isAudioMuted(audElement));
    }
    vidElement.onclick = () => {
        toggleLocalVideo(vidElement);
        toggleVideoUI(vidElement, !isVideoMuted(vidElement));
    }
}

const assignRemoteClickHandlers = (rtmClient, uid, audElement, vidElement, kickElement) => {
    audElement.onclick = () => isAudioMuted(audElement) ? sendhostMessage(rtmClient,uid,'unmuteAudio') : sendhostMessage(rtmClient,uid,'muteAudio');
    vidElement.onclick = () => isVideoMuted(vidElement) ? sendhostMessage(rtmClient,uid,'unmuteVideo') : sendhostMessage(rtmClient,uid,'muteVideo');
    kickElement.onclick = () => sendhostMessage(rtmClient,uid,'kicked');
}



document.getElementById("start").onclick = function () {

    // Client Setup
    // Defines a client for RTC
    let client = AgoraRTC.createClient({
        mode: 'rtc',
        codec: "vp8"
    });
    let appid = document.getElementById("app-id").value;
    let name = document.getElementById("name").value;
    let channelid="any-channel";

    const rtmClient = AgoraRTM.createInstance(appid);
    client.init(appid,() => console.log("AgoraRTC client initialized") ,handleFail);

    
    const logout = () => {
        client.leave();
        rtmClient.logout();
        localStream.close();
        document.getElementById('me').innerHTML='';
        remoteStreams.innerHTML='';
        participantContainer.innerHTML='';
        Object.keys(remoteStreams).map((uid)=>{
            remoteStreams[uid].close();
        });
        localStream= undefined;
        remoteStreams={};
    };

    stopButton.onclick= logout;


    // The client joins the channel
    client.join(null,channelid,null, async (uid)=>{

        addParticipantToList(0, name)

        localStream = AgoraRTC.createStream({
            video: true,
            audio: false,
        });
        localStream.init(function(){
            localStream.play('me');
            client.publish(localStream); // Publish it to the channel
            const audElement = document.getElementById(`aud-btn-${0}`);
            const vidElement = document.getElementById(`vid-btn-${0}`);
            assignLocalClickHandlers(audElement, vidElement);
        });
        console.log(`App id : ${appid}\nChannel id : ${channelid}\nUser id : ${uid}`);

        await rtmClient.login({uid: `${uid}:${name}`});
        rtmClient.on('MessageFromPeer', function (message, peerId) {
            // Can check if host using the peerId
            console.log("recieved a message", peerId, message)
            const audElement = document.getElementById(`aud-btn-${0}`);
            const vidElement = document.getElementById(`vid-btn-${0}`);
            if(message.text === 'unmuteAudio'){
                toggleAudioUI(audElement, false);
                localStream.unmuteAudio();
            } 
            else if(message.text === 'muteAudio'){
                toggleAudioUI(audElement, true);
                localStream.muteAudio();
            } 
            else if(message.text === 'unmuteVideo'){
                toggleVideoUI(vidElement, false);
                localStream.unmuteVideo();
            } 
            else if(message.text === 'muteVideo'){
                toggleVideoUI(vidElement, true);
                localStream.muteVideo();
            } 
            else if(message.text === 'kicked'){
                logout();
            }
        });
        const channel = rtmClient.createChannel(channelid);
        channel.on('MemberJoined', async (rtmId) => {
            const uidSplit = rtmId.split(':');
            addParticipantToList(uidSplit[0], uidSplit[1]);
            const audElement = document.getElementById(`aud-btn-${uidSplit[0]}`);
            const vidElement = document.getElementById(`vid-btn-${uidSplit[0]}`);
            const kickElement = document.getElementById(`kick-btn-${uidSplit[0]}`);
            assignRemoteClickHandlers(rtmClient, rtmId, audElement, vidElement,kickElement);
        });
        channel.on('MemberLeft', (rtmId) => {
            const uidSplit = rtmId.split(':');
            removeParticipantFromList(uidSplit[0]);
        });
        await channel.join();
        const  existingPeers = await channel.getMembers();
        existingPeers.map( rtmId => {
            const uidSplit = rtmId.split(':');
            if(parseInt(uidSplit[0], 10)!== uid){
                addParticipantToList(uidSplit[0], uidSplit[1]);
                const audElement = document.getElementById(`aud-btn-${uidSplit[0]}`);
                const vidElement = document.getElementById(`vid-btn-${uidSplit[0]}`);
                const kickElement = document.getElementById(`kick-btn-${uidSplit[0]}`);
                assignRemoteClickHandlers(rtmClient, rtmId, audElement, vidElement,kickElement);
            }
        });

    },handleFail);

    //When a stream is added to a channel
    client.on('stream-added', function (evt) {
        client.subscribe(evt.stream, handleFail);
    });

    //When you subscribe to a stream
    client.on('stream-subscribed', function (evt) {
        let stream = evt.stream;
        addVideoStream(stream.getId());
        addToStreams(stream);
        console.log(remoteStreams);
        stream.play(String(stream.getId()));
    });

    //When a person is removed from the stream
    client.on('stream-removed',removeVideoStream);
    client.on('peer-leave',removeVideoStream);

    client.on('mute-audio', evt => toggleAudioUI(document.getElementById(`aud-btn-${evt.uid}`), true));
    client.on('unmute-audio', evt => toggleAudioUI(document.getElementById(`aud-btn-${evt.uid}`), false));
    client.on('mute-video', evt => toggleVideoUI(document.getElementById(`vid-btn-${evt.uid}`), true));
    client.on('unmute-video', evt => toggleVideoUI(document.getElementById(`vid-btn-${evt.uid}`), false));
};