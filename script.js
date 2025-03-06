class AudioPlayer {
    constructor() {
        this.audio = new Audio();
        this.songs = [];
        this.currentSongIndex = parseInt(localStorage.getItem('currentSongIndex')) || 0;
        this.isPlaying = false;
        this.favorites = [];
        this.audioContext = null;
        this.source = null;
        this.analyser = null;
        this.currentSpeed = 1.0;
        this.isNightMode = localStorage.getItem('nightMode') === 'true';
        this.isLoopMode = false;
        
        // Загружаем сохраненные песни
        this.loadSavedSongs();
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadSongs();
        this.loadFavorites();
        this.updatePlayerPlaylist();
        this.applyNightMode();
        
        // Восстанавливаем последнюю играющую песню
        if (this.songs.length > 0 && this.currentSongIndex < this.songs.length) {
            this.audio.src = this.songs[this.currentSongIndex].url;
            this.songTitle.textContent = this.songs[this.currentSongIndex].name;
            this.artist.textContent = 'Загруженный файл';
        }

        // Инициализируем AudioContext только при первом клике пользователя
        document.addEventListener('click', () => {
            if (!this.audioContext) {
                this.initializeAudioContext();
            }
        }, { once: true });
    }

    initializeElements() {
        // Кнопки управления
        this.playBtn = document.getElementById('playBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.volumeSlider = document.getElementById('volumeSlider');
        
        // Элементы информации о песне
        this.songTitle = document.querySelector('.song-title');
        this.artist = document.querySelector('.artist');
        
        // Прогресс-бар
        this.progressBar = document.querySelector('.progress');
        this.progressContainer = document.querySelector('.progress-bar');
        this.currentTimeEl = document.querySelector('.current-time');
        this.durationEl = document.querySelector('.duration');
        
        // Списки песен
        this.songsList = document.querySelector('.songs-list');
        this.favoritesList = document.querySelector('.favorites-list');
        
        // Вкладки
        this.tabBtns = document.querySelectorAll('.tab-btn');
        this.tabContents = document.querySelectorAll('.tab-content');
        
        // Добавляем элемент плейлиста
        this.playerSongsList = document.querySelector('.player-songs-list');

        // Новые элементы управления
        this.speedBtn = document.getElementById('speedBtn');
        this.loopBtn = document.getElementById('loopBtn');
        this.shuffleBtn = document.getElementById('shuffleBtn');
        this.nightModeBtn = document.getElementById('nightModeBtn');
    }

    setupEventListeners() {
        // Управление воспроизведением
        this.playBtn.addEventListener('click', () => {
            if (!this.audioContext) {
                this.initializeAudioContext();
            }
            this.togglePlay();
        });
        
        this.prevBtn.addEventListener('click', () => this.playPrevious());
        this.nextBtn.addEventListener('click', () => this.playNext());
        
        // Прогресс-бар
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.progressContainer.addEventListener('click', (e) => this.setProgress(e));
        
        // Громкость
        this.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        
        // Загрузка файлов
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Переключение вкладок
        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });
        
        // Обработка окончания песни
        this.audio.addEventListener('ended', () => this.playNext());

        // Сохраняем индекс текущей песни
        this.audio.addEventListener('play', () => {
            localStorage.setItem('currentSongIndex', this.currentSongIndex);
        });

        // Новые обработчики событий
        this.speedBtn.addEventListener('click', () => this.toggleSpeed());
        this.loopBtn.addEventListener('click', () => this.toggleLoop());
        this.shuffleBtn.addEventListener('click', () => this.shufflePlaylist());
        this.nightModeBtn.addEventListener('click', () => this.toggleNightMode());

        // Обработчик для добавления в избранное
        document.querySelectorAll('.fa-heart').forEach(heart => {
            heart.addEventListener('click', (e) => {
                e.stopPropagation();
                const songItem = e.target.closest('.song-item');
                const songName = songItem.querySelector('span').textContent;
                const song = this.songs.find(s => s.name === songName);
                if (song) {
                    this.toggleFavorite(song);
                }
            });
        });
    }

    // Новый метод для загрузки сохраненных песен
    loadSavedSongs() {
        const savedSongs = localStorage.getItem('songsData');
        if (savedSongs) {
            const songsData = JSON.parse(savedSongs);
            this.songs = songsData.map(song => ({
                ...song,
                url: this.base64ToUrl(song.data)
            }));
            this.favorites = JSON.parse(localStorage.getItem('favorites')) || [];
        }
    }

    // Метод для конвертации файла в base64
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    }

    // Метод для конвертации base64 в URL
    base64ToUrl(base64) {
        const byteString = atob(base64.split(',')[1]);
        const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        
        const blob = new Blob([ab], { type: mimeString });
        return URL.createObjectURL(blob);
    }

    // Обновленный метод handleFileSelect
    async handleFileSelect(e) {
        const files = Array.from(e.target.files);
        for (const file of files) {
            if (file.type.startsWith('audio/')) {
                try {
                    const base64Data = await this.fileToBase64(file);
                    const song = {
                        name: file.name,
                        url: URL.createObjectURL(file),
                        data: base64Data,
                        isFavorite: false
                    };
                    
                    // Проверяем, нет ли уже такой песни
                    const existingSong = this.songs.find(s => s.name === song.name);
                    if (!existingSong) {
                        this.songs.push(song);
                        this.saveSongs();
                        
                        // Обновляем все списки
                        this.loadSongs();
                        this.updatePlayerPlaylist();
                        
                        // Если это первая песня, начинаем её воспроизведение
                        if (this.songs.length === 1) {
                            this.playSong(song);
                        }

                        // Показываем уведомление об успешной загрузке
                        console.log('Песня успешно добавлена:', song.name);
                    } else {
                        console.log('Песня с таким именем уже существует:', song.name);
                    }
                } catch (error) {
                    console.error('Ошибка при загрузке файла:', error);
                }
            }
        }
        
        // Очищаем input для возможности повторной загрузки того же файла
        e.target.value = '';
    }

    // Обновленный метод saveSongs
    saveSongs() {
        const songsData = this.songs.map(song => ({
            name: song.name,
            data: song.data,
            isFavorite: song.isFavorite
        }));
        localStorage.setItem('songsData', JSON.stringify(songsData));
        localStorage.setItem('favorites', JSON.stringify(this.favorites));
    }

    // Обновленный метод loadSongs
    loadSongs() {
        // Очищаем список песен
        this.songsList.innerHTML = '';
        
        // Проверяем, есть ли песни
        if (this.songs.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = 'Нет загруженных песен';
            this.songsList.appendChild(emptyMessage);
            return;
        }

        // Добавляем каждую песню в список
        this.songs.forEach((song, index) => {
            const songElement = document.createElement('div');
            songElement.className = 'song-item';
            if (this.audio.src === song.url) {
                songElement.classList.add('active');
            }
            songElement.innerHTML = `
                <i class="fas fa-music"></i>
                <span class="song-name" title="Дважды нажмите для редактирования">${song.name}</span>
                <i class="fas fa-heart ${song.isFavorite ? 'favorite' : ''}" style="margin-left: auto;"></i>
                <i class="fas fa-edit"></i>
                <i class="fas fa-trash"></i>
            `;
            
            const nameSpan = songElement.querySelector('.song-name');
            const heartIcon = songElement.querySelector('.fa-heart');
            const editIcon = songElement.querySelector('.fa-edit');
            const trashIcon = songElement.querySelector('.fa-trash');
            
            // Обработчик редактирования названия
            editIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editSongName(song, nameSpan);
            });

            nameSpan.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.editSongName(song, nameSpan);
            });
            
            heartIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFavorite(song);
            });
            
            trashIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteSong(song);
            });
            
            songElement.addEventListener('click', () => {
                this.playSong(song);
            });
            
            this.songsList.appendChild(songElement);
        });

        // Обновляем отображение плейлиста
        this.updatePlayerPlaylist();
    }

    // Новый метод для редактирования названия песни
    editSongName(song, nameSpan) {
        const oldName = song.name;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = song.name;
        input.className = 'edit-song-name';
        
        const save = () => {
            const newName = input.value.trim();
            if (newName && newName !== oldName) {
                song.name = newName;
                this.saveSongs();
                this.loadSongs();
                this.updatePlayerPlaylist();
                if (this.audio.src === song.url) {
                    this.songTitle.textContent = newName;
                }
            } else {
                nameSpan.textContent = oldName;
            }
            input.remove();
            nameSpan.style.display = '';
        };

        input.addEventListener('blur', save);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                save();
            }
        });

        nameSpan.style.display = 'none';
        nameSpan.parentNode.insertBefore(input, nameSpan);
        input.focus();
        input.select();
    }

    deleteSong(song) {
        // Удаляем песню из основного списка
        this.songs = this.songs.filter(s => s.name !== song.name);
        
        // Удаляем песню из избранного
        this.favorites = this.favorites.filter(s => s.name !== song.name);
        
        // Если удаляемая песня сейчас играет, останавливаем воспроизведение
        if (this.audio.src === song.url) {
            this.audio.pause();
            this.isPlaying = false;
            this.updatePlayButton();
            this.songTitle.textContent = 'Название песни';
            this.artist.textContent = 'Исполнитель';
            this.progressBar.style.width = '0%';
            this.currentTimeEl.textContent = '0:00';
            this.durationEl.textContent = '0:00';
        }
        
        this.saveSongs();
        this.loadSongs();
        this.updateFavoritesList();
        this.updatePlayerPlaylist();
    }

    updateFavoritesList() {
        this.favoritesList.innerHTML = '';
        this.loadFavorites();
    }

    playSong(song) {
        if (!this.audioContext) {
            this.initializeAudioContext();
        }

        const wasPlaying = !this.audio.paused;
        this.audio.src = song.url;
        this.songTitle.textContent = song.name;
        this.artist.textContent = 'Загруженный файл';
        this.currentSongIndex = this.songs.findIndex(s => s.url === song.url);
        
        if (wasPlaying || this.isPlaying) {
            this.audio.play()
                .then(() => {
                    this.isPlaying = true;
                    this.updatePlayButton();
                })
                .catch(error => {
                    console.error('Ошибка воспроизведения:', error);
                    this.isPlaying = false;
                    this.updatePlayButton();
                });
        }
        
        this.updatePlayerPlaylist();
        localStorage.setItem('currentSongIndex', this.currentSongIndex);
    }

    togglePlay() {
        if (!this.audio.src && this.songs.length > 0) {
            this.playSong(this.songs[0]);
            return;
        }

        if (this.audio.paused) {
            this.audio.play()
                .then(() => {
                    this.isPlaying = true;
                    this.updatePlayButton();
                })
                .catch(error => {
                    console.error('Ошибка воспроизведения:', error);
                    this.isPlaying = false;
                    this.updatePlayButton();
                });
        } else {
            this.audio.pause();
            this.isPlaying = false;
            this.updatePlayButton();
        }
    }

    updatePlayButton() {
        this.playBtn.innerHTML = this.isPlaying ? 
            '<i class="fas fa-pause"></i>' : 
            '<i class="fas fa-play"></i>';
    }

    playNext() {
        if (this.songs.length > 0) {
            this.currentSongIndex = (this.currentSongIndex + 1) % this.songs.length;
            this.playSong(this.songs[this.currentSongIndex]);
        }
    }

    playPrevious() {
        if (this.songs.length > 0) {
            this.currentSongIndex = (this.currentSongIndex - 1 + this.songs.length) % this.songs.length;
            this.playSong(this.songs[this.currentSongIndex]);
        }
    }

    updateProgress() {
        const { duration, currentTime } = this.audio;
        const progressPercent = (currentTime / duration) * 100;
        this.progressBar.style.width = `${progressPercent}%`;
        this.currentTimeEl.textContent = this.formatTime(currentTime);
        this.durationEl.textContent = this.formatTime(duration);
    }

    setProgress(e) {
        const width = this.progressContainer.clientWidth;
        const clickX = e.offsetX;
        const duration = this.audio.duration;
        this.audio.currentTime = (clickX / width) * duration;
    }

    setVolume(value) {
        this.audio.volume = value / 100;
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    switchTab(tabId) {
        this.tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        
        this.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === tabId);
        });
    }

    loadFavorites() {
        this.favoritesList.innerHTML = '';
        const savedSongs = localStorage.getItem('songsData');
        if (savedSongs) {
            const songsData = JSON.parse(savedSongs);
            const favoriteSongs = songsData
                .filter(song => song.isFavorite)
                .map(song => ({
                    ...song,
                    url: this.base64ToUrl(song.data)
                }));
            
            favoriteSongs.forEach(song => {
                const songElement = document.createElement('div');
                songElement.className = 'song-item';
                songElement.innerHTML = `
                    <i class="fas fa-music"></i>
                    <span>${song.name}</span>
                    <i class="fas fa-heart favorite" style="margin-left: auto;"></i>
                    <i class="fas fa-trash"></i>
                `;
                
                const heartIcon = songElement.querySelector('.fa-heart');
                const trashIcon = songElement.querySelector('.fa-trash');
                
                heartIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleFavorite(song);
                });
                
                trashIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteSong(song);
                });
                
                songElement.addEventListener('click', () => {
                    this.playSong(song);
                });
                
                this.favoritesList.appendChild(songElement);
            });
        }
    }

    updatePlayerPlaylist() {
        this.playerSongsList.innerHTML = '';
        
        if (this.songs.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = 'Плейлист пуст';
            this.playerSongsList.appendChild(emptyMessage);
            return;
        }

        this.songs.forEach((song, index) => {
            const songElement = document.createElement('div');
            songElement.className = 'player-song-item';
            if (this.audio.src === song.url) {
                songElement.classList.add('active');
            }
            songElement.innerHTML = `
                <span class="player-song-number">${index + 1}</span>
                <span class="player-song-name" title="${song.name}">${song.name}</span>
                <div class="player-song-controls">
                    <i class="fas fa-heart ${song.isFavorite ? 'favorite' : ''}"></i>
                    <i class="fas fa-edit"></i>
                </div>
            `;
            
            const nameSpan = songElement.querySelector('.player-song-name');
            const editIcon = songElement.querySelector('.fa-edit');
            const heartIcon = songElement.querySelector('.fa-heart');
            
            editIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editSongName(song, nameSpan);
            });

            heartIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFavorite(song);
            });
            
            songElement.addEventListener('click', () => {
                this.playSong(song);
            });
            
            this.playerSongsList.appendChild(songElement);
        });
    }

    initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(this.bufferLength);
            
            this.canvas = document.getElementById('visualizer');
            this.canvasCtx = this.canvas.getContext('2d');
            
            // Подключаем аудио к анализатору
            this.source = this.audioContext.createMediaElementSource(this.audio);
            this.source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
            
            this.drawVisualizer();
        } catch (error) {
            console.error('Ошибка инициализации AudioContext:', error);
        }
    }

    drawVisualizer() {
        const draw = () => {
            requestAnimationFrame(draw);
            
            this.analyser.getByteFrequencyData(this.dataArray);
            
            this.canvas.width = this.canvas.clientWidth;
            this.canvas.height = this.canvas.clientHeight;
            
            const barWidth = (this.canvas.width / this.bufferLength) * 2.5;
            let barHeight;
            let x = 0;
            
            this.canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            this.canvasCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            for (let i = 0; i < this.bufferLength; i++) {
                barHeight = this.dataArray[i] / 2;
                
                const gradient = this.canvasCtx.createLinearGradient(0, 0, 0, this.canvas.height);
                gradient.addColorStop(0, '#00f2fe');
                gradient.addColorStop(1, '#4facfe');
                
                this.canvasCtx.fillStyle = gradient;
                this.canvasCtx.fillRect(x, this.canvas.height - barHeight, barWidth, barHeight);
                
                x += barWidth + 1;
            }
        };
        
        draw();
    }

    shufflePlaylist() {
        this.originalSongs = [...this.songs];
        for (let i = this.songs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.songs[i], this.songs[j]] = [this.songs[j], this.songs[i]];
        }
        this.updatePlayerPlaylist();
    }

    updateFilteredPlaylist(filteredSongs) {
        this.playerSongsList.innerHTML = '';
        filteredSongs.forEach((song, index) => {
            const songElement = document.createElement('div');
            songElement.className = 'player-song-item';
            if (this.audio.src === song.url) {
                songElement.classList.add('active');
            }
            songElement.innerHTML = `
                <span class="player-song-number">${index + 1}</span>
                <span class="player-song-name">${song.name}</span>
            `;
            
            songElement.addEventListener('click', () => {
                this.playSong(song);
                this.updatePlayerPlaylist();
            });
            
            this.playerSongsList.appendChild(songElement);
        });
    }

    toggleSpeed() {
        const speeds = [0.5, 1.0, 1.5, 2.0];
        const currentIndex = speeds.indexOf(this.currentSpeed);
        this.currentSpeed = speeds[(currentIndex + 1) % speeds.length];
        this.audio.playbackRate = this.currentSpeed;
        this.speedBtn.textContent = `${this.currentSpeed}x`;
    }

    toggleLoop() {
        this.isLoopMode = !this.isLoopMode;
        this.audio.loop = this.isLoopMode;
        this.loopBtn.classList.toggle('active', this.isLoopMode);
    }

    toggleNightMode() {
        this.isNightMode = !this.isNightMode;
        localStorage.setItem('nightMode', this.isNightMode);
        this.applyNightMode();
    }

    applyNightMode() {
        document.body.classList.toggle('night-mode', this.isNightMode);
        this.nightModeBtn.classList.toggle('active', this.isNightMode);
    }

    toggleFavorite(song) {
        song.isFavorite = !song.isFavorite;
        
        // Обновляем список избранного
        if (song.isFavorite) {
            this.favorites.push({
                name: song.name,
                data: song.data,
                isFavorite: true
            });
        } else {
            this.favorites = this.favorites.filter(s => s.name !== song.name);
        }
        
        // Обновляем данные в localStorage
        this.saveSongs();
        
        // Обновляем отображение
        this.loadSongs();
        this.loadFavorites();
        
        // Показываем уведомление
        console.log(song.isFavorite ? 'Добавлено в избранное:' : 'Удалено из избранного:', song.name);
    }
}

// Инициализация плеера
const player = new AudioPlayer();
