from flask import Flask, request, jsonify
import os
import librosa
import numpy as np
import tensorflow as tf
from moviepy.editor import VideoFileClip

app = Flask(__name__)

model = tf.keras.models.load_model(r"C:\Users\revolve\Trained_model.h5")
classes = ['blues', 'classical', 'country', 'disco', 'Hip-Hop', 'jazz', 'metal', 'pop', 'reggae', 'rock']

def load_and_preprocess_data(file_path, target_shape=(150, 150)):
    print(f"Loading and preprocessing data from {file_path}")
    data = []
    audio_data, sample_rate = librosa.load(file_path, sr=None)
    chunk_duration = 4  # seconds
    overlap_duration = 2  # seconds
    chunk_samples = chunk_duration * sample_rate
    overlap_samples = overlap_duration * sample_rate
    num_chunks = int(np.ceil((len(audio_data) - chunk_samples) / (chunk_samples - overlap_samples))) + 1
    for i in range(num_chunks):
        start = i * (chunk_samples - overlap_samples)
        end = start + chunk_samples
        chunk = audio_data[start:end]
        mel_spectrogram = librosa.feature.melspectrogram(y=chunk, sr=sample_rate)
        mel_spectrogram = tf.image.resize(np.expand_dims(mel_spectrogram, axis=-1), target_shape)
        data.append(mel_spectrogram)
    print("Data preprocessing complete")
    return np.array(data)

def convert_to_mp3(input_file, output_file):
    print(f"Converting {input_file} to {output_file}")
    video_clip = VideoFileClip(input_file)
    audio_clip = video_clip.audio
    audio_clip.write_audiofile(output_file)
    video_clip.close()
    print("Conversion complete")

@app.route('/predict', methods=['POST'])
@app.route('/predict', methods=['POST'])
def predict():
    file = request.files['file']
    input_path = "input.webm"
    output_path = "output.mp3"
    print(f"Received file: {file.filename}")
    file.save(input_path)
    print(f"Saved input file as {input_path}")
    convert_to_mp3(input_path, output_path)
    X_test = load_and_preprocess_data(output_path)
    y_pred = model.predict(X_test)
    predicted_categories = np.argmax(y_pred, axis=1)
    unique_elements, counts = np.unique(predicted_categories, return_counts=True)
    max_count = np.max(counts)
    max_elements = unique_elements[counts == max_count]
    genre = classes[max_elements[0]]
    
    # Close or release any resources related to the input file before removing it
    if file and not file.closed:
        file.close()

    os.remove(input_path)
    os.remove(output_path)
    print(f"Predicted genre: {genre}")
    return jsonify({'genre': genre})


if __name__ == '__main__':
    app.run(port=5001)
