import requests
import traci
import sys
import logging
import time

# 配置日志
# 设置日志级别为 INFO，即记录信息级别的日志
# 定义日志格式，包含时间、日志级别和日志信息
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# SUMO 配置文件路径
# 网络文件路径，包含交通网络的拓扑信息
NET_FILE = "traffic.net.xml"
# 路由文件路径，包含车辆的行驶路线信息
ROUTE_FILE = "traffic.rou.xml"


def run_simulation():
    """
    运行 SUMO 仿真，并将交通数据发送到后端。
    """
    # 定义 SUMO 启动命令，使用 sumo - gui 以图形界面方式启动仿真
    sumo_cmd = ["sumo-gui", "-n", NET_FILE, "-r", ROUTE_FILE]
    # 启动 SUMO 仿真
    traci.start(sumo_cmd)

    try:
        # 当仿真中还有车辆时，继续仿真
        while traci.simulation.getMinExpectedNumber() > 0:
            # 执行一步仿真
            traci.simulationStep()
            # 获取当前仿真中的车辆数量
            vehicle_count = traci.vehicle.getIDCount()

            # 将数据发送到后端
            try:
                # 向后端 API 发送 POST 请求，携带路口 ID 和车辆数量信息
                response = requests.post(
                    'http://localhost:3000/api/traffic-data',
                    json={
                        'intersection_id': 'intersection_01',
                        'vehicle_count': vehicle_count
                    },
                    timeout=5  # 设置超时时间为 5 秒
                )
                if response.status_code == 200:
                    # 请求成功，记录日志
                    logging.info(f"数据推送成功: {vehicle_count} 辆车")
                else:
                    # 请求失败，记录错误日志
                    logging.error(f"数据推送失败: {response.status_code} - {response.text}")
            except requests.exceptions.RequestException as e:
                # 请求异常，记录错误日志
                logging.error(f"请求失败: {e}")

    except Exception as e:
        # 仿真运行出现异常，记录错误日志
        logging.error(f"仿真运行失败: {e}")
    finally:
        # 关闭 SUMO 仿真连接
        traci.close()
        # 记录仿真关闭日志
        logging.info("SUMO 仿真已关闭")


# 信号灯相位配置矩阵
PHASE_MATRIX = {
    'red': {
        # 红灯状态下的信号灯状态编码
        'state': 'rrrGGG',
        # 红灯持续时间
        'duration': 30,
        # 从其他状态切换到红灯时的黄灯过渡时间
        'transition': 3
    },
    'green': {
        # 绿灯状态下的信号灯状态编码
        'state': 'GGGrrr',
        # 绿灯持续时间
        'duration': 45,
        # 从其他状态切换到绿灯时的黄灯过渡时间
        'transition': 3
    },
    'yellow': {
        # 黄灯状态下的信号灯状态编码
        'state': 'yyyrrr',
        # 黄灯持续时间
        'duration': 5
    }
}


def switch_light(action):
    """增强型信号灯控制"""
    try:
        # 根据传入的动作获取对应的相位配置，如果动作不在配置中，默认使用绿灯配置
        phase_config = PHASE_MATRIX.get(action, PHASE_MATRIX['green'])

        # 执行黄灯过渡
        if action in ['red', 'green']:
            # 设置信号灯为黄灯状态
            traci.trafficlight.setRedYellowGreenState(
                'intersection_01',
                PHASE_MATRIX['yellow']['state']
            )
            # 设置黄灯持续时间
            traci.trafficlight.setPhaseDuration(
                'intersection_01',
                PHASE_MATRIX['yellow']['duration']
            )
            # 等待黄灯持续时间结束
            time.sleep(PHASE_MATRIX['yellow']['duration'])

        # 设置目标相位
        # 设置信号灯为目标状态
        traci.trafficlight.setRedYellowGreenState(
            'intersection_01',
            phase_config['state']
        )
        # 设置目标状态的持续时间
        traci.trafficlight.setPhaseDuration(
            'intersection_01',
            phase_config['duration']
        )

        # 记录信号灯切换成功日志
        logging.info(f" 信号灯已切换至{action.upper()} 状态")
        return True
    except traci.TraCIException as e:
        # 信号灯控制出现异常，记录错误日志
        logging.error(f" 控制指令异常: {str(e)}")
        return False


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == '--action':
        # 如果传入 --action 参数，则切换信号灯
        # 获取要切换的信号灯状态，如果未提供则默认使用绿灯
        action = sys.argv[2] if len(sys.argv) > 2 else 'green'
        # 调用切换信号灯函数
        switch_light(action)
    else:
        # 否则运行仿真
        run_simulation()