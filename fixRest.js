const fs = require('fs');
const path = require('path');

const files = [
  'src/screens/WorkoutSessionScreen.tsx',
  'src/screens/TrainingScreen.tsx',
  'src/screens/HistoryScreen.tsx',
  'src/screens/HabitsScreen.tsx',
  'src/screens/EvolutionScreen.tsx',
  'src/screens/AuthScreen.tsx',
  'src/components/ExerciseBlock.tsx',
  'src/components/HabitsCompactBar.tsx',
  'src/components/RoutineCard.tsx',
  'src/components/WorkoutCard.tsx',
  'src/components/RoutineEditorModal.tsx',
  'src/components/HabitCheckbox.tsx',
  'src/components/RestTimerBar.tsx',
  'src/components/ExerciseSearchInput.tsx'
];

for (let f of files) {
  let content = fs.readFileSync(f, 'utf8');
  let originalContent = content;

  content = content.replace(/export const (\w+)[^]*?=> \{/, (match) => {
    let inject = '';
    if (!content.includes('const { colors') && !content.includes('const { colors,')) {
       inject += '\n  const { colors, isDark } = useTheme();';
    }
    if (!content.includes('const styles = makeStyles(colors)')) {
       inject += '\n  const styles = makeStyles(colors);';
    }
    return match + inject;
  });

  if (content !== originalContent) {
    fs.writeFileSync(f, content, 'utf8');
    console.log('Fixed', f);
  }
}
