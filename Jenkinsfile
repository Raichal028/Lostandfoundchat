pipeline {
    agent any

    stages {

        stage('Checkout Code') {
            steps {
                git branch: 'main', url: 'https://github.com/Raichal028/Lostandfoundchat.git'
            }
        }

        stage('Build Docker Image') {
            steps {
                bat 'docker build -t lostandfound-backend ./server'
            }
        }

        stage('Stop Old Container') {
            steps {
                bat 'docker rm -f backend || exit 0'
            }
        }

        stage('Run Container') {
            steps {
                bat 'docker run -d -p 5000:5000 --name backend lostandfound-backend'
            }
        }

        stage('Show Running Containers') {
            steps {
                bat 'docker ps'
            }
        }
    }
}
