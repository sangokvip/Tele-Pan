// Telegram Media Uploader Frontend
class TelegramUploader {
    constructor() {
        this.files = [];
        this.uploadArea = document.getElementById('upload-area');
        this.fileInput = document.getElementById('file-input');
        this.browseBtn = document.getElementById('browse-btn');
        this.fileList = document.getElementById('file-list');
        this.filesContainer = document.getElementById('files-container');
        this.progressSection = document.getElementById('progress-section');
        this.overallProgress = document.getElementById('overall-progress');
        this.results = document.getElementById('results');
        this.resultsContainer = document.getElementById('results-container');
        
        this.initEventListeners();
    }
    
    initEventListeners() {
        // Drag and drop events
        this.uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        this.uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        
        // Click to browse
        this.browseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.fileInput.click();
        });
        this.uploadArea.addEventListener('click', (e) => {
            // Only trigger file input if clicking on the upload area itself, not on buttons
            if (e.target === this.uploadArea || e.target.closest('.upload-content')) {
                if (!e.target.closest('button')) {
                    this.fileInput.click();
                }
            }
        });
        
        // File input change
        this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
    }
    
    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('dragover');
    }
    
    handleDragLeave(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
    }
    
    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        this.addFiles(files);
    }
    
    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.addFiles(files);
    }
    
    addFiles(newFiles) {
        console.log('Selected files:', newFiles);
        
        // Log file details for debugging
        newFiles.forEach(file => {
            console.log(`File: ${file.name}, Type: ${file.type}, Size: ${file.size}`);
        });
        
        // Filter for images and videos only
        const validFiles = newFiles.filter(file => {
            // Check MIME type first
            const hasValidMimeType = file.type.startsWith('image/') || file.type.startsWith('video/');
            
            // If MIME type is empty, check file extension as fallback
            const fileExtension = file.name.toLowerCase().split('.').pop();
            const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
            const videoExtensions = ['mp4', 'avi', 'mov', 'webm'];
            const hasValidExtension = imageExtensions.includes(fileExtension) || videoExtensions.includes(fileExtension);
            
            const isValid = hasValidMimeType || hasValidExtension;
            console.log(`File ${file.name} is valid: ${isValid} (MIME: ${file.type}, Extension: ${fileExtension})`);
            return isValid;
        });
        
        console.log(`Valid files: ${validFiles.length} out of ${newFiles.length}`);
        
        if (validFiles.length !== newFiles.length) {
            this.showNotification('只支持图片和视频文件', 'warning');
        }
        
        if (validFiles.length === 0) {
            this.showNotification('请选择有效的图片或视频文件', 'error');
            return;
        }
        
        this.files = [...this.files, ...validFiles.map(file => ({
            file,
            id: Date.now() + Math.random(),
            status: 'pending',
            progress: 0
        }))];
        
        this.renderFileList();
        this.showUploadButton();
    }
    
    renderFileList() {
        if (this.files.length === 0) {
            this.fileList.style.display = 'none';
            return;
        }
        
        this.fileList.style.display = 'block';
        this.filesContainer.innerHTML = this.files.map(fileObj => `
            <div class="file-item" data-id="${fileObj.id}">
                <div class="file-info">
                    <div class="file-name">${fileObj.file.name}</div>
                    <div class="file-details">
                        ${this.formatFileSize(fileObj.file.size)} • ${fileObj.file.type}
                        ${fileObj.telegramMessageId ? ` • Message ID: ${fileObj.telegramMessageId}` : ''}
                    </div>
                    ${fileObj.error ? `<div class="file-error">${fileObj.error}</div>` : ''}
                </div>
                <div class="file-status-container">
                    <div class="file-status status-${fileObj.status}">
                        ${this.getStatusText(fileObj.status)}
                    </div>
                    ${fileObj.status === 'failed' ? `<button class="retry-btn" onclick="window.uploader.retryFile('${fileObj.id}')">重试</button>` : ''}
                </div>
            </div>
        `).join('');
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    getStatusText(status) {
        const statusMap = {
            pending: '等待中',
            uploading: '上传中',
            sending: '发送中',
            success: '成功',
            failed: '失败'
        };
        return statusMap[status] || status;
    }
    
    showUploadButton() {
        if (this.files.length > 0 && !document.getElementById('upload-btn')) {
            const uploadBtn = document.createElement('button');
            uploadBtn.id = 'upload-btn';
            uploadBtn.className = 'browse-btn';
            uploadBtn.textContent = '开始上传';
            uploadBtn.style.marginLeft = '10px';
            uploadBtn.addEventListener('click', this.startUpload.bind(this));
            this.browseBtn.parentNode.appendChild(uploadBtn);
        }
    }
    
    async startUpload() {
        this.progressSection.style.display = 'block';
        
        // Use batch upload for multiple files, single upload for one file
        if (this.files.length > 1) {
            await this.batchUpload();
        } else {
            await this.uploadFile(this.files[0], 0);
        }
        
        this.showResults();
    }
    
    async batchUpload() {
        // Set all files to uploading status
        this.files.forEach(fileObj => {
            fileObj.status = 'uploading';
        });
        this.renderFileList();
        
        const formData = new FormData();
        this.files.forEach(fileObj => {
            formData.append('files', fileObj.file);
        });
        
        try {
            // Update status to sending
            this.files.forEach(fileObj => {
                fileObj.status = 'sending';
            });
            this.renderFileList();
            
            const response = await fetch('/api/batch-upload', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success && result.data && result.data.results) {
                // Update each file with its result
                result.data.results.forEach((uploadResult, index) => {
                    if (index < this.files.length) {
                        const fileObj = this.files[index];
                        if (uploadResult.success) {
                            fileObj.status = 'success';
                            fileObj.telegramMessageId = uploadResult.telegramMessageId;
                            fileObj.fileSize = uploadResult.fileSize;
                            fileObj.fileType = uploadResult.fileType;
                        } else {
                            fileObj.status = 'failed';
                            fileObj.error = uploadResult.error;
                        }
                    }
                });
            } else {
                // If batch upload failed, mark all as failed
                this.files.forEach(fileObj => {
                    fileObj.status = 'failed';
                    fileObj.error = result.error || 'Batch upload failed';
                });
            }
        } catch (error) {
            // If network error, mark all as failed
            const errorMessage = this.handleNetworkError(error);
            this.files.forEach(fileObj => {
                fileObj.status = 'failed';
                fileObj.error = errorMessage;
            });
        }
        
        this.updateOverallProgress();
        this.renderFileList();
    }
    
    async uploadFile(fileObj, index) {
        fileObj.status = 'uploading';
        this.renderFileList();
        
        const formData = new FormData();
        formData.append('file', fileObj.file);
        
        try {
            fileObj.status = 'sending';
            this.renderFileList();
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success && result.data) {
                fileObj.status = 'success';
                fileObj.telegramMessageId = result.data.telegramMessageId;
                fileObj.fileSize = result.data.fileSize;
                fileObj.fileType = result.data.fileType;
            } else {
                fileObj.status = 'failed';
                fileObj.error = result.error || 'Upload failed';
            }
        } catch (error) {
            fileObj.status = 'failed';
            fileObj.error = error.message;
        }
        
        this.updateOverallProgress();
        this.renderFileList();
    }
    
    updateOverallProgress() {
        const completed = this.files.filter(f => f.status === 'success' || f.status === 'failed').length;
        const progress = (completed / this.files.length) * 100;
        
        const progressFill = this.overallProgress.querySelector('.progress-fill');
        const progressText = this.overallProgress.querySelector('.progress-text');
        
        progressFill.style.width = progress + '%';
        progressText.textContent = Math.round(progress) + '%';
    }
    
    showResults() {
        const successful = this.files.filter(f => f.status === 'success').length;
        const failed = this.files.filter(f => f.status === 'failed').length;
        const failedFiles = this.files.filter(f => f.status === 'failed');
        
        this.results.style.display = 'block';
        
        let resultsHTML = `
            <div class="results-summary">
                <h4>上传结果汇总</h4>
                <div class="summary-stats">
                    <div class="stat-item success">
                        <span class="stat-number">${successful}</span>
                        <span class="stat-label">成功</span>
                    </div>
                    <div class="stat-item failed">
                        <span class="stat-number">${failed}</span>
                        <span class="stat-label">失败</span>
                    </div>
                    <div class="stat-item total">
                        <span class="stat-number">${this.files.length}</span>
                        <span class="stat-label">总计</span>
                    </div>
                </div>
            </div>
        `;
        
        if (failed > 0) {
            resultsHTML += `
                <div class="failed-files-section">
                    <h5>失败的文件:</h5>
                    <div class="failed-files-list">
                        ${failedFiles.map(file => `
                            <div class="failed-file-item">
                                <span class="failed-file-name">${file.file.name}</span>
                                <span class="failed-file-error">${file.error}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        resultsHTML += `
            <div class="results-actions">
                ${failed > 0 ? '<button id="retry-failed" class="browse-btn">重试失败的文件</button>' : ''}
                <button id="upload-more" class="browse-btn" style="margin-left: 10px;">上传更多文件</button>
            </div>
        `;
        
        this.resultsContainer.innerHTML = resultsHTML;
        
        if (failed > 0) {
            document.getElementById('retry-failed').addEventListener('click', this.retryFailed.bind(this));
        }
        
        document.getElementById('upload-more').addEventListener('click', this.reset.bind(this));
    }
    
    retryFailed() {
        const failedFiles = this.files.filter(f => f.status === 'failed');
        failedFiles.forEach(f => f.status = 'pending');
        this.renderFileList();
        this.startUpload();
    }
    
    async retryFile(fileId) {
        const fileObj = this.files.find(f => f.id === fileId);
        if (!fileObj) return;
        
        fileObj.status = 'pending';
        fileObj.error = null;
        this.renderFileList();
        
        await this.uploadFile(fileObj, 0);
        this.updateOverallProgress();
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
        
        // Allow manual close
        notification.addEventListener('click', () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }
    
    handleNetworkError(error, fileObj = null) {
        let errorMessage = '网络连接失败';
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = '无法连接到服务器，请检查网络连接';
        } else if (error.message.includes('timeout')) {
            errorMessage = '上传超时，请重试';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        if (fileObj) {
            fileObj.error = errorMessage;
        }
        
        this.showNotification(errorMessage, 'error');
        return errorMessage;
    }
    
    reset() {
        this.files = [];
        this.fileList.style.display = 'none';
        this.progressSection.style.display = 'none';
        this.results.style.display = 'none';
        
        const uploadBtn = document.getElementById('upload-btn');
        if (uploadBtn) uploadBtn.remove();
        
        this.fileInput.value = '';
    }
}

// Initialize the uploader when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.uploader = new TelegramUploader();
});