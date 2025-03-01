The AI architect has generated a code framework that meets the following architecture_principles according to the following user requirements document.

<product_requirement>
{{ @variable prd }}
</product_requirement>

Please implement the following code file to meet product requirement:

<code_file>
{{ @variable codeFile }}
</code_file>

Ultra Important: to make sure fully implemented:

- Following every `// TODO(ai-coder) $task_description` comment, understand the description and replace the placeholder code with real implementation.
- **Importatnt**: Ensure all the TODO comments have been implemented. If you need to leave some new TODO comments or mock logic, **SHOULD** return a stop action instead, explain the reason and ask the user to provide the information you need. But remember, you and the coder are better at coding than the user, so do not ask detail coding implementation.
