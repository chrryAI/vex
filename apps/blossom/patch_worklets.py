import os

path = 'node_modules/react-native-reanimated/scripts/reanimated_utils.rb'
with open(path, 'r') as f:
    content = f.read()

target = 'react_native_worklets_node_modules_dir = File.join(File.dirname(`cd "#{Pod::Config.instance.installation_root.to_s}" && node --print "require.resolve(\'react-native-worklets/package.json\')"`), \'..\')'
replacement = 'react_native_worklets_node_modules_dir = File.expand_path(File.join(File.dirname(`cd "#{Pod::Config.instance.installation_root.to_s}" && node --print "require.resolve(\'react-native-worklets/package.json\')"`), \'..\'))'

if target in content:
    new_content = content.replace(target, replacement)
    with open(path, 'w') as f:
        f.write(new_content)
    print("Successfully patched worklets path in reanimated_utils.rb")
else:
    print("Target string for worklets not found")
    # Debug
    for line in content.splitlines():
        if 'react_native_worklets_node_modules_dir =' in line:
            print(f"Found line: {line}")
