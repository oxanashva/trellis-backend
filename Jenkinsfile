pipeline {
    agent { label 'built-in' }
    environment {
        DOCKER_HUB_USER = credentials('DOCKER_HUB_USER')
        IMAGE_NAME = "${DOCKER_HUB_USER}/trellis-backend"
        RENDER_DEPLOY_HOOK = credentials('RENDER_BACKEND_HOOK') // Use a specific hook for backend
        SHORT_SHA = sh(script: "git rev-parse --short HEAD", returnStdout: true).trim()
    }
    stages {
        stage('Install & Lint') {
            steps {
                sh 'npm install'
                sh 'npm run lint' 
            }
        }
        stage('Unit Tests') {
            steps {
                // Ensure your package.json has a "test" script
                sh 'npm test'
            }
        }
        stage('Build & Push Image') {
            steps {
                script {
                    docker.withRegistry('', 'DOCKER_HUB_CREDS') {
                        def backendImage = docker.build("${IMAGE_NAME}:${SHORT_SHA}", ".")
                        backendImage.push()
                        backendImage.push('latest')
                    }
                }
            }
        }
        stage('Deploy API to Render') {
            steps {
                sh "curl -X GET '${RENDER_DEPLOY_HOOK}&imgURL=docker.io/${IMAGE_NAME}:${SHORT_SHA}'"
            }
        }
    }
    post {
        always { sh "docker rmi ${IMAGE_NAME}:${SHORT_SHA} || true" }
    }
}