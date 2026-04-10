const fs = require("fs");
const fpath = "C:/Users/tucan/Documents/stefano/hackaton/huggingface_gradio/private_personal_assistant/apps/desktop/src-tauri/src/form_fill.rs";
let c = fs.readFileSync(fpath, "utf8");

const newTests = `

    #[test]
    fn test_parse_with_extra_text() {
        let response = "Here are the fields:\n[{\\"label\\": \\"Name\\", \\"category\\": \\"full_name\\", \\"type\\": \\"simple\\"}]\nMore text.";