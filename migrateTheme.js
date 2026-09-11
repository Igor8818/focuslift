const fs = require('fs');
const path = require('path');

const files = [
  "src/screens/WorkoutSessionScreen.tsx",
  "src/screens/TrainingScreen.tsx",
  "src/screens/HistoryScreen.tsx",
  "src/screens/HabitsScreen.tsx",
  "src/screens/EvolutionScreen.tsx",
  "src/screens/AuthScreen.tsx",
  "src/components/ExerciseBlock.tsx",
  "src/components/HabitsCompactBar.tsx",
  "src/components/RoutineCard.tsx",
  "src/components/WorkoutCard.tsx",
  "src/components/RoutineEditorModal.tsx",
  "src/components/HabitCheckbox.tsx",
  "src/components/RestTimerBar.tsx",
  "src/components/ExerciseSearchInput.tsx"
];

for (const file of files) {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file}`);
    continue;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  // Replace import
  content = content.replace(
    /import \{ Colors \} from '\.\.\/theme\/colors';/g,
    "import { useTheme } from '../contexts/ThemeContext';"
  );
  content = content.replace(
    /import \{ Colors \} from '\.\.\/\.\.\/theme\/colors';/g,
    "import { useTheme } from '../../contexts/ThemeContext';"
  );
  
  // Find component declaration
  const compRegex = /export const (\w+)[:\sReact\.FC<[^>]*>]* = \([^)]*\) => \{/g;
  
  content = content.replace(compRegex, (match, compName) => {
    return `${match}
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);`;
  });
  
  // Fix styles creation
  content = content.replace(
    /const styles = StyleSheet\.create\(\{/g,
    "function makeStyles(colors: any) {\n  return StyleSheet.create({"
  );
  
  if (content.includes("function makeStyles(colors: any) {")) {
    const lastIndex = content.lastIndexOf("});");
    if (lastIndex !== -1) {
      content = content.substring(0, lastIndex) + "});\n}\n" + content.substring(lastIndex + 3);
    }
  }
  
  content = content.replace(/Colors\./g, 'colors.');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
}
