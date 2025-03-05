import requests
import traci
import sys
import logging

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# SUMO 配置文件路径
NET_FILE = "traffic.net.xml"
ROUTE_FILE = "traffic.rou.xml"

def run_simulation():
    """
    运行 SUMO 仿真，并将交通数据发送到后端。
    """
    sumo_cmd = ["sumo-gui", "-n", NET_FILE, "-r", ROUTE_FILE]
    traci.start(sumo_cmd)

    try:
        while traci.simulation.getMinExpectedNumber() > 0:
            traci.simulationStep()
            vehicle_count = traci.vehicle.getIDCount()

            # 将数据发送到后端
            try:
                response = requests.post(
                    'http://localhost:3000/api/traffic-data',
                    json={
                        'intersection_id': 'intersection_01',
                        'vehicle_count': vehicle_count
                    },
                    timeout=5  # 设置超时时间
                )
                if response.status_code == 200:
                    logging.info(f"数据推送成功: {vehicle_count} 辆车")
                else:
                    logging.error(f"数据推送失败: {response.status_code} - {response.text}")
            except requests.exceptions.RequestException as e:
                logging.error(f"请求失败: {e}")

    except Exception as e:
        logging.error(f"仿真运行失败: {e}")
    finally:
        traci.close()
        logging.info("SUMO 仿真已关闭")

def switch_light(action):
    """
    切换信号灯状态。
    :param action: 信号灯动作（如 'green', 'red', 'yellow'）
    """
    logging.info(f"切换信号灯为: {action}")
    # 在这里实现信号灯切换逻辑
    # 例如：traci.trafficlight.setRedYellowGreenState('intersection_01', 'GGGrrr')

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == '--action':
        # 如果传入 --action 参数，则切换信号灯
        action = sys.argv[2] if len(sys.argv) > 2 else 'green'
        switch_light(action)
    else:
        # 否则运行仿真
        run_simulation()
