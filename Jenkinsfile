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
                sh 'docker build -t lostandfound .'
            }
        }

        stage('Stop Old Container') {
            steps {
                sh 'docker rm -f lostandfound || true'
            }
        }

        stage('Run Container') {
            steps {
                sh 'docker run -d -p 3000:3000 --name lostandfound lostandfound'
            }
        }
    }
}