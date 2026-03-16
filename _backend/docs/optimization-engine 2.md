# Optimization Engine Documentation

## Overview

The Optimization Engine is a comprehensive scheduling optimization service that implements advanced algorithms to maximize provider utilization and minimize patient wait times. It provides intelligent scheduling recommendations and automated optimization capabilities for the EcoDigital appointment scheduling system.

## Features

### 1. Schedule Optimization
- **Utilization Maximization**: Automatically identifies opportunities to increase provider schedule utilization
- **Wait Time Minimization**: Optimizes appointment scheduling to reduce patient wait times
- **Load Balancing**: Distributes appointments evenly across available time slots
- **Buffer Time Optimization**: Calculates optimal buffer times between appointments based on complexity

### 2. Intelligent Algorithms
- **Greedy Slot Assignment**: Efficiently assigns appointments to optimal time slots
- **Priority-Based Scheduling**: Considers appointment urgency and patient priority
- **Conflict Detection**: Identifies and resolves scheduling conflicts
- **Pattern Analysis**: Analyzes historical data to improve future scheduling

### 3. Performance Analytics
- **Utilization Metrics**: Tracks provider schedule utilization rates
- **Wait Time Analysis**: Monitors and analyzes patient wait times
- **Efficiency Reporting**: Provides comprehensive performance metrics
- **Optimization Scoring**: Quantifies optimization improvements

## API Endpoints

### POST /api/v1/optimization/schedule
Optimizes schedule for a provider within a date range.

**Request Body:**
```json
{
  "providerId": "1",
  "startDate": "2024-01-01",
  "endDate": "2024-01-07",
  "options": {
    "utilizationWeight": 0.6,
    "waitTimeWeight": 0.4
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "providerId": "1",
    "dateRange": {
      "startDate": "2024-01-01",
      "endDate": "2024-01-07"
    },
    "currentMetrics": {
      "utilization": 0.75,
      "averageWaitTime": 15,
      "onTimeRate": 0.80
    },
    "optimizedSchedule": {
      "modifications": []
    },
    "recommendations": [],
    "improvementMetrics": {
      "utilizationImprovement": 0.1,
      "waitTimeReduction": 5,
      "efficiencyImprovement": 0.05
    },
    "optimizationScore": 75
  }
}
```

### POST /api/v1/optimization/utilization
Maximizes provider utilization for a specific date.

**Request Body:**
```json
{
  "providerId": "1",
  "date": "2024-01-01",
  "constraints": {
    "maxDailyAppointments": 20,
    "appointmentTypeRestrictions": {}
  }
}
```

### POST /api/v1/optimization/wait-times
Minimizes patient wait times through intelligent scheduling.

**Request Body:**
```json
{
  "providerId": "1",
  "date": "2024-01-01",
  "appointmentRequests": [
    {
      "id_paciente": "123",
      "tipo_cita": "CONSULTA_GENERAL",
      "duracion_minutos": 30
    }
  ]
}
```

### GET /api/v1/optimization/metrics/:providerId
Retrieves optimization metrics for a provider.

**Query Parameters:**
- `startDate`: Start date for metrics (optional)
- `endDate`: End date for metrics (optional)
- `includeRecommendations`: Include optimization recommendations (default: true)

### GET /api/v1/optimization/recommendations/:providerId
Gets optimization recommendations for a provider.

**Query Parameters:**
- `startDate`: Start date for analysis (optional)
- `endDate`: End date for analysis (optional)
- `priority`: Filter by priority level (high, medium, low, all)

### POST /api/v1/optimization/simulate
Simulates optimization results for proposed modifications.

**Request Body:**
```json
{
  "providerId": "1",
  "date": "2024-01-01",
  "modifications": [
    {
      "type": "BUFFER_ADJUSTMENT",
      "expectedWaitTimeReduction": 3
    }
  ]
}
```

## Configuration

The optimization engine can be configured with the following parameters:

```javascript
{
  // Weight factors for optimization objectives
  utilizationWeight: 0.6,        // Priority given to utilization (0-1)
  waitTimeWeight: 0.4,           // Priority given to wait time reduction (0-1)
  
  // Scheduling constraints
  maxDailyAppointments: 20,      // Maximum appointments per day
  minBufferTimeMinutes: 5,       // Minimum buffer between appointments
  maxBufferTimeMinutes: 15,      // Maximum buffer between appointments
  
  // Optimization thresholds
  minUtilizationThreshold: 0.7,  // Minimum acceptable utilization
  maxWaitTimeMinutes: 30,        // Maximum acceptable wait time
  
  // Algorithm parameters
  maxIterations: 1000,           // Maximum optimization iterations
  convergenceThreshold: 0.001    // Convergence threshold for algorithms
}
```

## Optimization Algorithms

### 1. Utilization Maximization
- **Greedy Algorithm**: Assigns appointments to highest-scoring available slots
- **Slot Scoring**: Considers time of day, duration, and provider preferences
- **Priority Handling**: Processes urgent appointments first
- **Constraint Satisfaction**: Respects scheduling constraints and preferences

### 2. Wait Time Minimization
- **Buffer Time Optimization**: Calculates optimal buffer times based on appointment complexity
- **Appointment Reordering**: Optimizes appointment sequence to minimize delays
- **Pattern Analysis**: Uses historical data to predict and prevent delays
- **Dynamic Adjustment**: Adapts to real-time schedule changes

### 3. Load Balancing
- **Hourly Distribution Analysis**: Identifies peak and off-peak periods
- **Appointment Redistribution**: Suggests moving appointments to balance load
- **Capacity Planning**: Optimizes resource allocation across time periods
- **Demand Forecasting**: Predicts future scheduling needs

## Performance Metrics

### Utilization Metrics
- **Current Utilization**: Percentage of scheduled time actually used
- **Optimized Utilization**: Projected utilization after optimization
- **Utilization Improvement**: Increase in utilization percentage

### Wait Time Metrics
- **Average Wait Time**: Mean patient wait time
- **Maximum Wait Time**: Longest patient wait time
- **On-Time Rate**: Percentage of appointments starting on time

### Efficiency Metrics
- **Completion Rate**: Percentage of scheduled appointments completed
- **Optimization Score**: Overall optimization effectiveness (0-100)
- **Improvement Potential**: Estimated improvement from optimization

## Usage Examples

### Basic Schedule Optimization
```javascript
const optimizationEngine = new OptimizationEngine();

const result = await optimizationEngine.optimizeSchedule(
  '1',                           // Provider ID
  new Date('2024-01-01'),       // Start date
  new Date('2024-01-07'),       // End date
  { utilizationWeight: 0.7 }    // Options
);

console.log('Optimization Score:', result.data.optimizationScore);
```

### Utilization Maximization
```javascript
const result = await optimizationEngine.maximizeUtilization(
  '1',                          // Provider ID
  new Date('2024-01-01'),      // Target date
  { maxDailyAppointments: 25 } // Constraints
);

console.log('Utilization Improvement:', result.data.utilizationImprovement);
```

### Wait Time Minimization
```javascript
const appointmentRequests = [
  { id_paciente: '123', tipo_cita: 'CONSULTA_GENERAL' }
];

const result = await optimizationEngine.minimizeWaitTimes(
  '1',                          // Provider ID
  new Date('2024-01-01'),      // Target date
  appointmentRequests          // New appointment requests
);

console.log('Wait Time Reduction:', result.data.waitTimeReduction);
```

## Integration

### Database Requirements
The optimization engine requires the following database tables:
- `CITAS`: Appointment records
- `HORARIOS_MEDICOS`: Provider schedules
- `EXCEPCIONES_HORARIO`: Schedule exceptions
- `LISTA_ESPERA`: Waitlist entries
- `PACIENTES`: Patient information
- `USUARIOS`: Provider information

### Dependencies
- Node.js 14+
- PostgreSQL database
- Express.js framework
- Database connection pool

### Error Handling
The optimization engine includes comprehensive error handling:
- Database connection errors
- Invalid input validation
- Optimization algorithm failures
- Resource constraint violations

## Testing

The optimization engine includes comprehensive test coverage:

### Unit Tests
- Configuration validation
- Algorithm correctness
- Metric calculations
- Error handling

### Integration Tests
- Database interactions
- API endpoint functionality
- End-to-end optimization flows

### Performance Tests
- Large dataset handling
- Concurrent optimization requests
- Algorithm efficiency

Run tests with:
```bash
npm test -- optimization-engine.test.js
npm test -- optimization-core.test.js
```

## Monitoring and Logging

The optimization engine provides detailed logging for:
- Optimization requests and results
- Performance metrics
- Error conditions
- Algorithm execution times

Logs are structured for easy analysis and monitoring.

## Future Enhancements

Planned improvements include:
- Machine learning-based optimization
- Real-time optimization adjustments
- Advanced constraint handling
- Multi-provider optimization
- Predictive scheduling analytics