Write-Output "注意事项："
Write-Output "1、本脚本不会自动下载CDN离线包，请自行到官网下载并解压到：$(Get-Location)\Common"
Write-Output "2、替换前，请确保文案内容压缩包存在，避免替换出错后可重新解压覆盖进行还原。"
Write-Output "3、是否确认替换？确认请按回车，取消请关闭窗口或终止（Ctrl+C）"

pause

Write-Output "开始替换中，请稍候。。。"

# 将当前目录(包括子目录)下的所有HTML文件内容进行替换
Get-ChildItem '*.html' -Recurse | ForEach {
    # (Get-Content $_) | ForEach  {$_ -Replace 'weekly', 'monthly'} | Set-Content $_
	Write-Output "正在替换，文件：$_"
	(Get-Content -LiteralPath $_) | ForEach  {$_ -Replace 'https://fastly.jsdelivr.net', 'https://cdn.jsdelivr.net' -Replace 'https://cdn.staticfile.org/jquery/3.6.0/', '../Common/vendors/npm/jquery@3.6.0/dist/' -Replace 'https://cdn.staticfile.org/moment.js/2.27.0/moment.min.js', '../Common/vendors/npm/moment@2.27.0/min/moment.min.js' -Replace 'https://cdn.staticfile.org/moment.js/2.27.0/locale/zh-cn.min.js', '../Common/vendors/npm/moment@2.27.0/min/moment-with-locales.min.js' -Replace 'https://cdn.staticfile.org/bootstrap/4.6.1/', '../Common/vendors/npm/bootstrap@4.6.1/dist/' -Replace 'https://cdn.staticfile.org/echarts/5.4.1/echarts.min.js', '../Common/vendors/npm/echarts@5.4.1/echarts.min.js' -Replace 'https://cdn.staticfile.org/lodash.js/4.17.21/', '../Common/vendors/npm/lodash@4.17.21/' -Replace 'https://cdn.staticfile.org/font-awesome/4.7.0/', '../Common/vendors/npm/font-awesome@4.7.0/' -Replace 'https://cdn.staticfile.org/jquery-mousewheel/3.1.13/', '../Common/vendors/npm/jquery-mousewheel@3.1.13/' -Replace 'https://cdn.staticfile.org/lightgallery/2.3.0/', '../Common/vendors/npm/lightgallery@2.3.0/' -Replace 'https://cdn.staticfile.org/jquery_lazyload/2.0.0-rc.2/', '../Common/vendors/npm/lazyload@2.0.0-rc.2/' -Replace 'https://cdn.jsdelivr.net/npm/template_js@2.2.1/', '../Common/vendors/npm/template_js@2.2.1/' -Replace 'https://cdn.staticfile.org/bootstrap-table/1.19.1/', '../Common/vendors/npm/bootstrap-table@1.19.1/dist/' -Replace 'https://www.lvshuncai.com/custom/js/clicklove.min.js', '../Common/vendors/npm/clicklove/clicklove.min.js' -Replace 'https://cdn.jsdelivr.net/gh/', '../Common/vendors/gh/' -Replace 'integrity=".+" crossorigin="anonymous"', ''} | Out-File $_ -Encoding UTF8NoBOM
	Write-Output "替换完成，文件：$_"
	Write-Output "=========================================================="
}
Write-Output "正在替换，文件：$(Get-Location)\index.html"

# 替换首页文件
$INDEX_PATH = "$(Get-Location)\index.html"

(Get-Content -LiteralPath $INDEX_PATH) -Replace '../Common/vendors', 'Common/vendors' | Out-File index.html -Encoding UTF8NoBOM

Write-Output "替换完成，文件：$INDEX_PATH"

Write-Output "替换完成，按回车退出。。。"

pause