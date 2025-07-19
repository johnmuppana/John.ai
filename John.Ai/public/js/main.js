document.addEventListener('DOMContentLoaded', function () {
            const hamburgerBtn = document.getElementById('hamburgerBtn');
            const sidebarOverlay = document.getElementById('mobileSidebarOverlay');
            const closeSidebarBtn = document.getElementById('closeSidebarBtn');
            const mobileSidebar = document.querySelector('.mobile-sidebar');

            hamburgerBtn.addEventListener('click', () => {
                sidebarOverlay.classList.remove('hidden');
                setTimeout(() => {
                    mobileSidebar.classList.add('open');
                }, 10);
                sidebarOverlay.focus();
            });

            function closeSidebar() {
                mobileSidebar.classList.remove('open');
                setTimeout(() => {
                    sidebarOverlay.classList.add('hidden');
                    hamburgerBtn.focus();
                }, 300);
            }

            closeSidebarBtn.addEventListener('click', closeSidebar);
            sidebarOverlay.addEventListener('click', (e) => {
                if (e.target === sidebarOverlay) {
                    closeSidebar();
                }
            });

            document.querySelectorAll('.assistant-message pre').forEach(pre => {
                const wrapper = document.createElement('div');
                wrapper.className = 'relative group';
                const codeText = pre.innerText;

                const copyBtn = document.createElement('button');
                copyBtn.textContent = 'Copy';
                copyBtn.className = 'absolute top-2 right-2 text-xs bg-slate-700 text-white px-2 py-1 rounded hidden group-hover:block';
                copyBtn.onclick = () => {
                    navigator.clipboard.writeText(codeText);
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => {
                        copyBtn.textContent = 'Copy';
                    }, 2000);
                };

                pre.className = 'bg-gray-900 text-white text-sm p-3 rounded-md overflow-x-auto';
                pre.parentNode.insertBefore(wrapper, pre);
                wrapper.appendChild(pre);
                wrapper.appendChild(copyBtn);
            });
        });

        let currentChatId = window.currentChatId || null;

        function autoResize(textarea) {
            textarea.style.height = 'auto';
            const maxHeight = 160;
            textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
            textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
        }

        async function sendMessage() {
    const input = document.getElementById('userInput');
    const chatBox = document.getElementById('chat');
    const message = input.value.trim();
    if (!message) return;

    // Remove greeting if present
    const greeting = document.getElementById("greetingMessage");
    if (greeting) greeting.remove();


            chatBox.innerHTML += `
        <div class="flex justify-end message">
            <div class="bg-indigo-100 text-gray-800 px-5 py-3 rounded-2xl max-w-lg shadow whitespace-pre-wrap">${message}</div>
        </div>
    `;
            input.value = '';
            autoResize(input);
            chatBox.scrollTop = chatBox.scrollHeight;

            const loading = document.createElement('div');
            loading.className = 'flex justify-start message';
            loading.innerHTML = `
        <div class="px-5 py-3 text-gray-400 text-sm blinking-cursor">Waiting</div>
    `;
            chatBox.appendChild(loading);
            chatBox.scrollTop = chatBox.scrollHeight;

            try {
                const params = new URLSearchParams();
                params.append('message', message);
                if (currentChatId) params.append('chatId', currentChatId);

                const response = await fetch('/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: params.toString()
                });

                const text = await response.text();
                let reply = text;
                try {
                    const json = JSON.parse(text);
                    reply = json.reply;
                    currentChatId = json.chatId;
                } catch (e) { }

                const html = marked.parse(reply);
                loading.remove();

                const markdownBody = document.createElement('div');
                markdownBody.className = 'markdown-body assistant-message message';
                chatBox.appendChild(markdownBody);

                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;
                const nodes = Array.from(tempDiv.childNodes);
                let i = 0;

                function typeBlock(index) {
                    if (index >= nodes.length) {
                        markdownBody.querySelectorAll('pre').forEach(pre => {
                            const wrapper = document.createElement('div');
                            wrapper.className = 'relative group';
                            const codeText = pre.innerText;
                            const copyBtn = document.createElement('button');
                            copyBtn.textContent = 'Copy';
                            copyBtn.className = 'absolute top-2 right-2 text-xs bg-slate-700 text-white px-2 py-1 rounded hidden group-hover:block';
                            copyBtn.onclick = () => {
                                navigator.clipboard.writeText(codeText);
                                copyBtn.textContent = 'Copied!';
                                setTimeout(() => {
                                    copyBtn.textContent = 'Copy';
                                }, 2000);
                            };
                            pre.className = 'bg-gray-900 text-white text-sm p-3 rounded-md overflow-x-auto';
                            pre.parentNode.insertBefore(wrapper, pre);
                            wrapper.appendChild(pre);
                            wrapper.appendChild(copyBtn);
                        });
                        chatBox.scrollTop = chatBox.scrollHeight;
                        return;
                    }

                    const node = nodes[index];

                    if (node.tagName === 'TABLE') {
                        const table = document.createElement('table');
                        table.className = 'w-full border-collapse my-4 markdown-table';
                        markdownBody.appendChild(table);
                        chatBox.scrollTop = chatBox.scrollHeight;

                        const rows = Array.from(node.querySelectorAll('tr'));
                        let rowIndex = 0;

                        function typeRow() {
                            if (rowIndex >= rows.length) {
                                typeBlock(index + 1);
                                return;
                            }
                            const row = rows[rowIndex];
                            const newRow = document.createElement('tr');
                            const cells = Array.from(row.children);
                            let cellIndex = 0;

                            function typeCell() {
                                if (cellIndex >= cells.length) {
                                    table.appendChild(newRow);
                                    rowIndex++;
                                    setTimeout(typeRow, 150);
                                    return;
                                }
                                const cell = cells[cellIndex];
                                const newCell = document.createElement(cell.tagName.toLowerCase());
                                newCell.style.opacity = 0;
                                newCell.style.transition = 'opacity 0.2s ease';
                                newCell.textContent = cell.textContent;
                                newRow.appendChild(newCell);
                                setTimeout(() => {
                                    newCell.style.opacity = 1;
                                    cellIndex++;
                                    typeCell();
                                }, 50);
                            }
                            typeCell();
                        }
                        setTimeout(() => typeRow(), 200);
                    } else if (node.tagName === 'PRE') {
                        const wrapper = document.createElement('div');
                        wrapper.className = 'relative group';
                        const codeElement = node.querySelector('code');
                        const codeText = codeElement?.innerText || node.innerText;
                        const pre = document.createElement('pre');
                        pre.className = 'bg-gray-900 text-white text-sm p-3 rounded-md overflow-x-auto';
                        pre.textContent = '';
                        const copyBtn = document.createElement('button');
                        copyBtn.textContent = 'Copy';
                        copyBtn.className = 'absolute top-2 right-2 text-xs bg-slate-700 text-white px-2 py-1 rounded hidden group-hover:block';
                        copyBtn.onclick = () => {
                            navigator.clipboard.writeText(codeText);
                            copyBtn.textContent = 'Copied!';
                            setTimeout(() => {
                                copyBtn.textContent = 'Copy';
                            }, 2000);
                        };
                        wrapper.appendChild(pre);
                        wrapper.appendChild(copyBtn);
                        markdownBody.appendChild(wrapper);
                        let j = 0;

                        function typeCode() {
                            if (j <= codeText.length) {
                                pre.textContent = codeText.substring(0, j);
                                chatBox.scrollTop = chatBox.scrollHeight;
                                j++;
                                setTimeout(typeCode, 10);
                            } else {
                                typeBlock(index + 1);
                            }
                        }
                        typeCode();
                    } else {
                        const p = document.createElement('p');
                        p.innerHTML = node.nodeType === 1 ? node.innerHTML : node.textContent;
                        markdownBody.appendChild(p);
                        chatBox.scrollTop = chatBox.scrollHeight;
                        setTimeout(() => typeBlock(index + 1), 5);
                    }
                }

                typeBlock(i);
            } catch (err) {
                loading.remove();
                chatBox.innerHTML += `
            <div class="flex justify-start message">
                <div class="bg-red-100 px-5 py-3 rounded-2xl max-w-lg border shadow text-red-700">❌ Failed to fetch response.</div>
            </div>
        `;
                chatBox.scrollTop = chatBox.scrollHeight;
            }
        }

        document.addEventListener('keydown', function (e) {
            const input = document.getElementById('userInput');
            if (e.key === 'Enter' && !e.shiftKey && document.activeElement === input) {
                e.preventDefault();
                sendMessage();
            }
        });
        