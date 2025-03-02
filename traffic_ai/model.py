# traffic_ai/model.py
from keras.models import Sequential
from keras.layers import LSTM, Dense, Dropout
from keras.callbacks import TensorBoard

def build_model(input_shape):
    model = Sequential()
    model.add(LSTM(128, return_sequences=True, input_shape=input_shape))
    model.add(Dropout(0.2))
    model.add(LSTM(64))
    model.add(Dense(32, activation='relu'))
    model.add(Dense(1))
    model.compile(loss='mse', optimizer='adam')
    return model

# 训练过程
pipeline = DataPipeline()
data = pipeline.load_data().values
scaled_data = pipeline.scaler.fit_transform(data)

X, y = pipeline.create_sequences(scaled_data)
X = X.reshape((X.shape[0], X.shape[1], 3))  # 3个特征维度

model = build_model((X.shape[1], 3))
model.fit(X, y,
          epochs=200,
          batch_size=32,
          validation_split=0.2,
          callbacks=[TensorBoard(log_dir='./logs')])

# 启动TensorBoard查看训练过程
# tensorboard --logdir=./logs