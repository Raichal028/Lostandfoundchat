pipeline {
    agent any

    stages {

        stage('Checkout') {
            steps {
                git branch: 'main', url: 'https://github.com/Raichal028/Lostandfoundchat.git'
            }
        }

        stage('Stop Old Containers') {
            steps {
                sh '''
                    docker stop backend mongo-db || true
                    docker rm backend mongo-db || true
                '''
            }
        }

        stage('Build Backend Image') {
            steps {
                sh 'docker build -t backend ./server'
            }
        }

        stage('Run MongoDB') {
            steps {
                sh 'docker run -d --name mongo-db -p 27017:27017 mongo:6 || true'
            }
        }

        stage('Run Backend') {
            steps {
                sh 'docker run -d --name backend -p 5000:5000 backend || true'
            }
        }

        stage('Verify Running Containers') {
            steps {
                sh 'docker ps'
            }
        }
    }
}