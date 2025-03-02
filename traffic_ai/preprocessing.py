# traffic_ai/preprocessing.py
import pandas as pd
from sklearn.preprocessing import MinMaxScaler

class DataPipeline:
    def __init__(self, window_size=10):
        self.scaler = MinMaxScaler(feature_range=(0, 1))
        self.window = window_size

    def load_data(self):
        # 从数据库加载数据
        df = pd.read_sql("SELECT * FROM traffic_data", con=engine)
        return df[['vehicle_count', 'avg_speed', 'waiting_pedestrians']]

    def create_sequences(self, data):
        X, y = [], []
        for i in range(len(data)-self.window-1):
            seq = data[i:(i+self.window)]
            target = data[i+self.window]
            X.append(seq)
            y.append(target[0])  # 预测车辆数
        return np.array(X), np.array(y)