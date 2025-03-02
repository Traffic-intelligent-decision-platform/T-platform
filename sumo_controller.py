# sumo_controller.py
import traci
import time
from threading import Thread

class SumoController:
    def __init__(self):
        self.sumo_cmd = ["sumo-gui", "-n", "cross.net.xml", "-r", "traffic.rou.xml"]
        self.running = False

    def start_simulation(self):
        traci.start(self.sumo_cmd)
        self.running = True
        Thread(target=self.data_collector).start()

    def data_collector(self):
        while self.running:
            # 采集多维度数据
            data = {
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                "vehicle_count": traci.vehicle.getIDCount(),
                "avg_speed": traci.vehicle.getAverageSpeed(),
                "waiting_pedestrians": traci.person.getIDCount()
            }
            # 发送到后端
            requests.post('http://localhost:5000/api/traffic-data', json=data)
            time.sleep(5)  # 每5秒发送一次

    def set_traffic_light(self, phase):
        tl_id = traci.trafficlight.getIDList()[0]  # 获取第一个信号灯
        traci.trafficlight.setPhase(tl_id, phase)

# 使用示例
if __name__ == "__main__":
    controller = SumoController()
    controller.start_simulation()
    # 运行中可通过 controller.set_traffic_light(2) 手动切换相位