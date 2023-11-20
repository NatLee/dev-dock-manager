
function handleContainerAction(html_btn, cmd) {
    containerID = html_btn.dataset.id;
    let url = '/dashboard/api/containers/start-stop-remove'
    let data = { 'id': containerID, 'cmd': cmd };
    //console.log(cmd + "->" + containerID);

    // Retrieve the JWT from local storage
    const accessToken = localStorage.getItem('accessToken');

    fetch(url, {
       method: "POST",
       body: JSON.stringify(data),
       headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${accessToken}`
      },
    }).then(response => {
       if (!response.ok) {
           window.location.href = '/login';
       }
       return response.json();    
    }).then(data => {
        let task_id = data.task_id;
        console.log('Task ID: ' + task_id);
    })
 }

function fetchAndDisplayContainers() {

     // Retrieve the JWT from local storage
     const accessToken = localStorage.getItem('accessToken');

     fetch('/dashboard/api/containers', {
         method: "GET",
         headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${accessToken}`
         },
     })
        .then(response => response.json())
        .then(data => {
            const containers = data.containers;
            const table = document.getElementById('containerTableBody');
            table.innerHTML = '';

            containers.forEach(item => {
                let actionButtons = '';

                if (item.status === "running") {
                    actionButtons = `
                        <button id="novncBtn" class="btn btn-info btn-sm me-3" onclick="window.open('/novnc/${item.name}/?path=novnc/${item.name}/websockify')">NoVNC</button>
                        <button class="btn btn-info btn-sm me-3" onclick="window.open('/dashboard/console/shell/${item.id}')">Console</button>
                        <button class="btn btn-info btn-sm me-3" onclick="window.open('/dashboard/console/attach/${item.id}')">Attach</button>
                        <button data-id="${item.id}" class="btn btn-warning btn-sm me-3" onclick="handleContainerAction(this, 'restart')">Restart</button>
                        <button data-id="${item.id}" class="btn btn-warning btn-sm me-3" onclick="handleContainerAction(this, 'stop')">Stop</button>
                    `;
                } else {
                    actionButtons = `
                        <button data-id="${item.id}" class="btn btn-success btn-sm me-3" onclick="handleContainerAction(this, 'start')">Start</button>
                        <button data-id="${item.id}" class="btn btn-danger btn-sm" onclick="handleContainerAction(this, 'remove')">Remove</button>
                    `;
                }

                // Include indicators for privileged and nvdocker status
                const privilegedStatus = item.privileged ? '<span class="badge bg-warning text-dark">Privileged</span>' : '';
                const nvdockerStatus = item.nvdocker ? '<span class="badge bg-success">NV-Docker</span>' : '';

                const row = `
                <tr>
                    <td>${item.short_id}</td>
                    <td>${item.name}</td>
                    <td>${item.ports.ssh}</td>
                    <td>${privilegedStatus} ${nvdockerStatus}</td>
                    <td>
                        <div class='d-flex'>
                            <span class="btn ${item.status === "running" ? 'btn-success' : 'btn-secondary'} btn-sm" id="${item.id}-span">${item.status}</span>
                        </div>
                    </td>
                    <td>
                        <div class='d-flex' id="actions-${item.id}">
                            ${actionButtons}
                        </div>
                    </td>
                </tr>`;
                table.innerHTML += row;
            });
        })
        .catch(error => {
            console.error('Error fetching container data:', error);
        });
}


function notificationWebsocket() {

    var ws_scheme = window.location.protocol == "https:" ? "wss" : "ws";
    var ws_path = ws_scheme + '://' + window.location.host + "/ws/notifications/";
    var socket = new WebSocket(ws_path);

    // Update the status of the WebSocket connection
    function updateWebSocketStatus(isConnected) {
        const statusElement = document.getElementById("websocket-status");
        if (statusElement) {
            statusElement.classList.toggle('connected', isConnected);
            statusElement.classList.toggle('disconnected', !isConnected);
        }
    }

    socket.onopen = function () {
        updateWebSocketStatus(true);
    };

    socket.onmessage = function (event) {
        const data = JSON.parse(event.data);
        console.log('Notification message:', data.message);
        let action = data.message.action;
        if (action === "WAITING") {
            createToastAlert(data.message.details, false);
            let containerID = data.message.data.container_id;
            // get the record from the table by id
            let record = document.getElementById("actions-" + containerID);
            // block actions & show the waiting status
            record.innerHTML = `
                <span class="btn btn-warning btn-sm me-3">Waiting</span>
            `;
        }
        if (action === "CREATED" || action === "STARTED" || action === "STOPPED" || action === "REMOVED" || action === "RESTARTED") {
            createToastAlert(data.message.details, false);
            fetchAndDisplayContainers();
        }

    };

    socket.onclose = function (e) {
        updateWebSocketStatus(false);
        console.error('Notification WebSocket closed unexpectedly:', e);

        // Reconnect after 3 seconds
        setTimeout(notificationWebsocket, 3000);
    };

    // Handle any errors that occur.
    socket.onerror = function (error) {
        updateWebSocketStatus(false);
        console.error('WebSocket Error:', error);
    };

}

document.addEventListener('DOMContentLoaded', fetchAndDisplayContainers);
document.addEventListener('DOMContentLoaded', notificationWebsocket);
