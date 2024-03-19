import os
import azure.cognitiveservices.speech as speechsdk
from flask_socketio import SocketIO
from flask_cors import CORS
from flask import Flask, request, jsonify  # Import jsonify here
import numpy as np

from azure.cognitiveservices.speech import (
    SpeechConfig,
    SpeechSynthesisOutputFormat,
    audio,
    SpeechSynthesizer,
)
import json
import sounddevice as sd
import numpy as np
import logging
import time
import threading  # Import threading module
import soundfile as sf

import os
import json
from dotenv import load_dotenv

load_dotenv()

import os

from langchain_openai import AzureChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

# from langchain.schema import SystemMessage, HumanMessage, AIMessage

llm = AzureChatOpenAI(
    deployment_name="gpt35", 
    model_name="gpt-35-turbo",
    
    )
messages = [
    SystemMessage(
        content="Your name is Harmony, you are an intelligent assistant ready to make life easier. The user can simply say your name to activate you, you can listen and assist him with anything he needs. You can also speak and listen to the user."
    ),
    AIMessage(
        content="Hello there! how can I assist you today?"
    ),
]

# Define the list of blend shape names
blend_shape_names = [
    "eyeBlinkLeft",
    "eyeLookDownLeft",
    "eyeLookInLeft",
    "eyeLookOutLeft",
    "eyeLookUpLeft",
    "eyeSquintLeft",
    "eyeWideLeft",
    "eyeBlinkRight",
    "eyeLookDownRight",
    "eyeLookInRight",
    "eyeLookOutRight",
    "eyeLookUpRight",
    "eyeSquintRight",
    "eyeWideRight",
    "jawForward",
    "jawLeft",
    "jawRight",
    "jawOpen",
    "mouthClose",
    "mouthFunnel",
    "mouthPucker",
    "mouthLeft",
    "mouthRight",
    "mouthSmileLeft",
    "mouthSmileRight",
    "mouthFrownLeft",
    "mouthFrownRight",
    "mouthDimpleLeft",
    "mouthDimpleRight",
    "mouthStretchLeft",
    "mouthStretchRight",
    "mouthRollLower",
    "mouthRollUpper",
    "mouthShrugLower",
    "mouthShrugUpper",
    "mouthPressLeft",
    "mouthPressRight",
    "mouthLowerDownLeft",
    "mouthLowerDownRight",
    "mouthUpperUpLeft",
    "mouthUpperUpRight",
    "browDownLeft",
    "browDownRight",
    "browInnerUp",
    "browOuterUpLeft",
    "browOuterUpRight",
    "cheekPuff",
    "cheekSquintLeft",
    "cheekSquintRight",
    "noseSneerLeft",
    "noseSneerRight",
    "tongueOut",
    "headRoll",
    "leftEyeRoll",
    "rightEyeRoll",
]

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", logger=False)

app.logger.disabled = True
log = logging.getLogger("werkzeug")
log.disabled = True
logging.getLogger("werkzeug").disabled = True

# Load Azure subscription key and region from environment variables
subscription_key = "9e6304a69de341589285ea98fdfdcb48"
region = "eastus"


@socketio.on("connect")
def handle_connect():
    print("Client connected")

@socketio.on("disconnect")
def handle_disconnect():
    print("Client disconnected")

def text_to_speech(text):
    """Converts text to speech using Azure Speech Services and emits viseme data via WebSocket."""

    try:
        ssml = f"""<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US">
            <voice name="en-US-AmberNeural">
                <mstts:viseme type="FacialExpression"/>
                {text}
            </voice>
        </speak>"""

        # Create speech configuration
        speech_config = SpeechConfig(subscription_key, region)
        speech_config.speech_synthesis_output_format = (
            SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3
        )
        # Creates an audio output stream
        pull_stream = audio.PullAudioOutputStream()
        # Creates a speech synthesizer using pull stream as audio output.
        stream_config = audio.AudioOutputConfig(stream=pull_stream)

        blend_data = []
        time_step = 1 / 60
        time_stamp = 0

        def viseme_received_handler(evt):
            nonlocal time_stamp
            animation = json.loads(evt.animation)

            for blendArray in animation["BlendShapes"]:
                blend = {}
                for i, shapeName in enumerate(blend_shape_names):
                    blend[shapeName] = blendArray[i]

                blend_data.append({"time": time_stamp, "blendshapes": blend})
                time_stamp += time_step

        synthesizer = SpeechSynthesizer(
            speech_config=speech_config, audio_config=stream_config
        )

        synthesizer.viseme_received.connect(viseme_received_handler)

        # Synthesize speech asynchronously
        synthesizer.speak_ssml_async(ssml).get()

        # time.sleep(10)
        del synthesizer

        socketio.emit("blend_data_from_server", blend_data)

        # Set the sample rate
        sample_rate = 16000

        stream = sd.OutputStream(samplerate=sample_rate, channels=1, dtype=np.int16)

        # Start the stream
        stream.start()
        audio_buffer = bytes(32000)
        filled_size = pull_stream.read(audio_buffer)
        total_size = 0

        while filled_size > 0:
            total_size += filled_size

            # Convert bytes to NumPy array
            audio_data = np.frombuffer(audio_buffer[:filled_size], dtype=np.int16)

            # Play the audio buffer chunk by chunk
            stream.write(audio_data)

            filled_size = pull_stream.read(audio_buffer)

        return True

    except Exception as e:
        print(f"An error occurred: {e}")
        socketio.emit("error", {"message": f"An error occurred: {e}"})
        # In case of errors, return an error response
        return False


def speech_recognize():
    """runs keyword spotting locally, with direct access to the result audio"""

    # Creates an instance of a keyword recognition model. Update this to
    # point to the location of your keyword recognition model.
    model = speechsdk.KeywordRecognitionModel(
        "2f42ef48-cb44-420c-9d93-4730650744a9.table"
    )

    # The phrase your keyword recognition model triggers on.
    keyword = "harmony"

    # Create a local keyword recognizer with the default microphone device for input.
    keyword_recognizer = speechsdk.KeywordRecognizer()

    done = False

    def recognized_cb(evt):
        # Only a keyword phrase is recognized. The result cannot be 'NoMatch'
        # and there is no timeout. The recognizer runs until a keyword phrase
        # is detected or recognition is canceled (by stop_recognition_async()
        # or due to the end of an input file or stream).
        result = evt.result
        if result.reason == speechsdk.ResultReason.RecognizedKeyword:
            # play start.mp3 using sounddevice
            data, fs = sf.read("assets/sound/blip.mp3", dtype="float32")
            sd.play(data, fs)
        nonlocal done
        done = True

    def canceled_cb(evt):
        result = evt.result
        if result.reason == speechsdk.ResultReason.Canceled:
            print("CANCELED: {}".format(result.cancellation_details.reason))
        nonlocal done
        done = True

    # Connect callbacks to the events fired by the keyword recognizer.
    keyword_recognizer.recognized.connect(recognized_cb)
    keyword_recognizer.canceled.connect(canceled_cb)

    # Start keyword recognition.
    result_future = keyword_recognizer.recognize_once_async(model)
    result = result_future.get()

    # Read result audio (incl. the keyword).
    if result.reason == speechsdk.ResultReason.RecognizedKeyword:
        # Start transcribing from the microphone.
        speech_config = SpeechConfig(subscription_key, region)

        speech_recognizer = speechsdk.SpeechRecognizer(speech_config=speech_config)
        result = speech_recognizer.recognize_once_async().get()
        
        data, fs = sf.read("assets/sound/blip2.wav", dtype="float32")
        sd.play(data, fs)
        # if result.text is empty, it means the recognizer did not recognize any speech
        if result.text == "":
            print("No speech could be recognized")
            text_to_speech("Yes, How can I assist you today?")
        # example : **** you. This is a bad word
        elif "*" in result.text.replace(" ", ""):
            print("Bad word detected")
            text_to_speech("I am sorry, Please be respectful.")
        else:
            message = HumanMessage(
                content=result.text
            )
            
            messages.append(message)

            res=llm(messages)
            
            answer = res.content
            
            messages.append(AIMessage(content=answer))

            text_to_speech(res.content)

        stop_future = keyword_recognizer.stop_recognition_async()
        stopped = stop_future.get()

        speech_recognize()


if __name__ == "__main__":
    # run the server and speech recognition simultaneously
    thread = threading.Thread(target=speech_recognize)
    thread.start()
    socketio.run(app, port=5050, host="0.0.0.0", debug=False)
