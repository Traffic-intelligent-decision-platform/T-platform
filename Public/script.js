let timeoutId;
function searchResources() {
    const input = document.getElementById('search-input').value.toLowerCase();
    const category = document.getElementById('category-filter').value;
    const resourcesContainer = document.getElementById('resources');
    // 显示加载动画
    resourcesContainer.innerHTML = '<div class="text-center">加载中...</div>';
    

    // 构建API URL
    let apiUrl = `http://localhost:3000/api/resources?query=${encodeURIComponent(input)}`;
    if (category) {
        apiUrl += `&category=${encodeURIComponent(category)}`;
    }

    // Fetch API获取资源并完善错误处理
    fetch(apiUrl)
      .then(response => {
            if (!response.ok) {
                throw new Error('网络问题: '+ response.statusText);
            }
            return response.json();
        })
      .then(data => {
            // 清除加载动画，显示结果
            resourcesContainer.innerHTML = '';
            if (data.length > 0) {
                data.forEach(resource => {
                    const resourceItem = document.createElement('div');
                    resourceItem.className ='resource-item';
                    resourceItem.innerHTML = `
                        <div class="resource-title">
                            <a href="${resource.link}" target="_blank">${resource.title}</a>
                        </div>
                        <div class="resource-description">${resource.description}</div>`;
                    resourcesContainer.appendChild(resourceItem);
                });
            } else {
                resourcesContainer.innerHTML = '<div class="no-result">没有找到相关资源。</div>';
            }
        })
      .catch(error => {
            console.error('查询错误:', error);
            // 清除加载动画，显示错误信息
            resourcesContainer.innerHTML = '<div class="no-result">查询失败，请重试。错误信息: '+ error.message + '</div>';
        });
}
function debounceSearch() {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
        searchResources();
    }, 300);
}
// 修改input事件绑定
document.getElementById('search-input').addEventListener('input', debounceSearch);
document.getElementById('category-filter').addEventListener('change', debounceSearch);
// 退出登录功能
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    // 清除本地存储
    localStorage.removeItem('token');
    // 跳转登录页
    window.location.href = 'login.html';
});