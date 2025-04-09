'use client';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  goToStep: (step: number) => void;
}

export default function StepIndicator({
  currentStep,
  totalSteps,
  goToStep
}: StepIndicatorProps) {
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center">
        {Array.from({length: totalSteps}).map((_, index) => (
          <div key={index} className="flex flex-col items-center flex-1">
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 step-indicator
                ${currentStep > index + 1 ? 'completed' : ''}
                ${currentStep === index + 1 ? 'active' : 'bg-gray-200 text-gray-600'}
              `}
              onClick={() => index + 1 < currentStep && goToStep(index + 1)}
              style={{cursor: index + 1 < currentStep ? 'pointer' : 'default'}}
            >
              {currentStep > index + 1 ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              ) : (
                index + 1
              )}
            </div>
            <div className="text-xs text-center step-text">
              {index === 0 ? 'Localização' : index === 1 ? 'Detalhes do Encontro' : 'Contato e Líder'}
            </div>
            {index < totalSteps - 1 && (
              <div className="hidden md:block w-full h-1 bg-gray-200 absolute" style={{top: '1.5rem', left: `${(100 / totalSteps) * (index + 1)}%`, width: `${100 / totalSteps}%`}}></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 